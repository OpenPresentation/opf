import assert from 'node:assert/strict';
import {test} from 'node:test';
import { colorSchemes } from './support/catalog.mjs'; import { CODE_HIGHLIGHT_LANGUAGES, CODE_HIGHLIGHT_MAX_LENGTH, CODE_PANEL_BACKGROUND, CODE_SYNTAX_MIN_CONTRAST, codeLineRuns, codeSyntaxPalette, colorContrast, resolveCodeLanguage, tokenizeCode } from '../dist/composition.js';

const SAMPLES={
  python:'import os\n\n@cache\ndef greet(name: str) -> str:\n    """Doc\n    string"""\n    # note\n    return f"Hello, {name}!" if name else None  # tail\n\nclass Box(Base):\n    size = 0x1F + 3.5e2\n',
  typescript:'// header\nimport {a} from "./a";\n/* block\n   comment */\nexport async function run<T>(input: Map<string, T>): Promise<void> {\n  const n = 42, ok = true;\n  return console.log(`n=${n}`, \'x\');\n}\n@Component({selector: "x"})\nclass View extends Base {}\n',
  rust:"use std::fmt;\n// c\nfn main() {\n    let s: &'static str = \"hi\\n\";\n    let r = r#\"raw\"#;\n    println!(\"{}\", 1_000u32);\n    for x in 0..10 { let _ = 'a'; }\n}\nstruct Point<'a> { x: i32 }\n",
  go:'package main\n\nimport "fmt"\n\n// Greet says hi\nfunc Greet(name string) error {\n\tmsg := `raw\nstring`\n\tfmt.Println(msg, 3.14, nil)\n\treturn nil\n}\n',
  bash:'#!/bin/bash\n# comment\nset -e\nNAME="$1"\nif [ -z "${NAME}" ]; then\n  echo \'single $quoted\' $HOME\nfi\n',
  json:'{\n  "name": "opf", // note\n  "n": [1, -2.5e3, true, null],\n  "nested": {"k": "v"}\n}\n',
  yaml:'# comment\nname: demo\nenabled: true\ncount: 42\nitems:\n  - id: 1\n    text: "quoted"\n  - plain value # tail\nscript: |\n  echo hi\n  # not a comment\nref: &anchor value\n',
  toml:'# c\n[server]\nhost = "localhost"\nport = 8080\ndebug = false\n',
  html:'<!-- note -->\n<!DOCTYPE html>\n<div class="box" id=\'a\' hidden>text &amp; more</div>\n<br/>\n',
  css:'/* c */\n@media (min-width: 600px) {\n  .box, #id > a { color: #fff; margin: -2.5rem 10px !important; background: rgb(0, 0, 0); }\n}\n',
  sql:"-- c\nSELECT id, name FROM users WHERE age >= 18 AND name = 'O''Neil' ORDER BY id LIMIT 10;\n",
  java:'@Override\npublic class Main {\n  public static void main(String[] args) {\n    int n = 1;\n    System.out.println("x");\n  }\n}\n',
  c:'#include <stdio.h>\n#define N 3\nint main(void) {\n  printf("hi\\n");\n  return 0;\n}\n',
  hcl:'resource "aws_s3_bucket" "b" {\n  bucket = "x"  # c\n  count  = 2\n}\n',
};
const SAMPLE_FOR={javascript:'typescript',ini:'toml',markup:'html',csharp:'java',kotlin:'java',swift:'java',ruby:'python',php:'java',dockerfile:'bash'};

test('every highlighted language scans its sample into sorted, non-overlapping tokens inside the source',()=>{
  for(const language of CODE_HIGHLIGHT_LANGUAGES) {
    const source=SAMPLES[language]??SAMPLES[SAMPLE_FOR[language]];
    assert.ok(source,`sample for ${language}`);
    const tokens=tokenizeCode(source,language);
    assert.ok(tokens.length>0,`${language} produces tokens`);
    let cursor=0;
    for(const token of tokens) {
      assert.ok(token.start>=cursor&&token.end>token.start&&token.end<=source.length,`${language} token ${JSON.stringify(token)}`);
      cursor=token.end;
    }
  }
});

test('line runs cover each source line exactly, clip multi-line tokens and keep the text unchanged',()=>{
  for(const [language,source] of Object.entries(SAMPLES)) for(const eol of ['\n','\r\n']) {
    const text=source.replace(/\n/g,eol),tokens=tokenizeCode(text,language);
    let rebuilt='';
    for(const match of text.matchAll(/[^\r\n]*(\r\n|\r|\n|$)/g)) {
      if(match[0]==='')continue;
      const line=match[0].replace(/(\r\n|\r|\n)$/,''),start=match.index,end=start+line.length;
      const runs=codeLineRuns(tokens,start,end);
      assert.equal(runs.map(run=>text.slice(run.start,run.end)).join(''),line,language);
      let at=start;for(const run of runs){assert.equal(run.start,at);assert.ok(run.end>run.start);at=run.end;}
      rebuilt+=match[0];
    }
    assert.equal(rebuilt,text);
  }
});

test('with the source, a tab is always its own plain run, even inside a multi-line token',()=>{
  const source='x = """a\n\tb\t"""\n',tokens=tokenizeCode(source,'python'),start=source.indexOf('\tb'),end=source.indexOf('\n',start);
  const runs=codeLineRuns(tokens,start,end,source);
  assert.deepEqual(runs.map(run=>[source.slice(run.start,run.end),run.kind]),[['\t',undefined],['b','string'],['\t',undefined],['"""','string']]);
  assert.equal(runs.map(run=>source.slice(run.start,run.end)).join(''),source.slice(start,end));
  // Without the source the runs are the clipped tokens.
  assert.deepEqual(codeLineRuns(tokens,start,end).map(run=>run.kind),['string']);
});

test('token kinds follow the language: comments, strings, numbers, keywords, definitions, calls and keys',()=>{
  const kinds=(source,language)=>tokenizeCode(source,language).map(token=>`${token.kind}:${source.slice(token.start,token.end)}`);
  assert.deepEqual(kinds('def f(x):  # hi\n  return 1','python'),['keyword:def','function:f','comment:# hi','keyword:return','number:1']);
  assert.deepEqual(kinds('class Foo(Bar): pass','python'),['keyword:class','type:Foo','type:Bar','keyword:pass']);
  assert.deepEqual(kinds('const x = "a" + 3;','ts'),['keyword:const','string:"a"','number:3']);
  assert.deepEqual(kinds('{"a": 1, "b": "c", "d": null}','json'),['property:"a"','number:1','property:"b"','string:"c"','property:"d"','number:null']);
  assert.deepEqual(kinds('key: value\nlist:\n  - n: 3','yaml'),['property:key','property:list','property:n','number:3']);
  assert.deepEqual(kinds("fn main() { let a = 'x'; }",'rust').slice(0,3),['keyword:fn','function:main','keyword:let']);
  assert.deepEqual(kinds('echo $HOME # x','sh'),['property:$HOME','comment:# x']);
  assert.deepEqual(kinds('#include <a.h>','cpp'),['keyword:#include','string:<a.h>']);
  assert.deepEqual(kinds('<a href="x">t</a>','html'),['keyword:a','property:href','string:"x"','keyword:/a']);
});

test('language names resolve through aliases; unknown or missing languages stay plain',()=>{
  for(const [name,id] of [['TS','typescript'],['tsx','typescript'],['Python3','python'],['js','javascript'],['golang','go'],['sh','bash'],['yml','yaml'],['language-rust','rust'],['.py','python'],['C++','c'],['c#','csharp'],['terraform','hcl']]) assert.equal(resolveCodeLanguage(name),id,name);
  for(const unknown of [undefined,null,'','brainfuck','text','plaintext',42,{}]) {assert.equal(resolveCodeLanguage(unknown),undefined);assert.deepEqual(tokenizeCode('let x = 1',unknown),[]);}
  assert.deepEqual(tokenizeCode('','python'),[]);
  assert.deepEqual(tokenizeCode('x'.repeat(CODE_HIGHLIGHT_MAX_LENGTH+1),'python'),[]);
});

test('tokenizing is deterministic, bounded and never throws on unterminated or hostile source',()=>{
  const hostile=['"""','"unterminated','/* open','<!-- open','`tpl ${','\'','r#"','#include <','{"a":','a: |\n  b','\u0000\uD800','𝒳 = 1'];
  for(const language of CODE_HIGHLIGHT_LANGUAGES) for(const source of hostile) assert.deepEqual(tokenizeCode(source,language),tokenizeCode(source,language));
  const big='let value = "text" // note\n'.repeat(7000);
  const started=Date.now();for(const language of ['typescript','css','yaml','html','python'])tokenizeCode(big.slice(0,CODE_HIGHLIGHT_MAX_LENGTH),language);
  assert.ok(Date.now()-started<5000,'bounded time');
  // Adversarial 200,000-character lines (long whitespace runs, repeated indicators) stay linear in every scanner.
  const n=CODE_HIGHLIGHT_MAX_LENGTH,hostileLines=['a'+' '.repeat(n-2),'key'+' '.repeat(n-5)+'x','#'.repeat(n),'"'.repeat(n),'<'.repeat(n),'<a '+'b '.repeat(n/2),'/*'.repeat(n/2),'- '.repeat(n/2),': '.repeat(n/2),'a"'.repeat(n/2)];
  const adversarial=Date.now();
  for(const language of CODE_HIGHLIGHT_LANGUAGES)for(const source of hostileLines)tokenizeCode(source,language);
  assert.ok(Date.now()-adversarial<20000,'linear on adversarial lines');
});

test('the palette keeps every token colour at >=4.5:1 on the code panel for every catalog colour scheme and extreme theme colours',()=>{
  const themes=colorSchemes.map(scheme=>({primary:scheme.accent1,secondary:scheme.accent2,accent:scheme.accent3,mutedText:scheme.dark2}));
  themes.push({},{primary:'#000000',secondary:'#000000',accent:'#000000',mutedText:'#000000'},{primary:'#FFFFFF',secondary:'#FFFFFF',accent:'#FFFFFF',mutedText:'#FFFFFF'},{primary:'#111827',secondary:'#111827',accent:'#111827',mutedText:'#111827'},{primary:'nonsense'});
  for(const theme of themes) {
    const palette=codeSyntaxPalette(theme);
    for(const [kind,color] of Object.entries(palette)) {
      assert.match(color,/^#[0-9A-F]{6}$/);
      assert.ok(colorContrast(color,CODE_PANEL_BACKGROUND)>=CODE_SYNTAX_MIN_CONTRAST,`${kind} ${color} for ${JSON.stringify(theme)}`);
    }
    // Token kinds stay distinguishable even when a theme repeats one colour.
    assert.ok(new Set(Object.values(palette)).size>=7,`distinct colours for ${JSON.stringify(theme)}`);
  }
  assert.deepEqual(codeSyntaxPalette({primary:'#2563EB'}),codeSyntaxPalette({primary:'#2563EB'}));
});
