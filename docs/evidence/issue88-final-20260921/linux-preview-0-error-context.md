# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: inspector.spec.ts >> anonymous JSON authoring, preview, undo/redo, download and shared reimport
- Location: tests/e2e/inspector.spec.ts:107:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-opf-renderer="0.9.0"] div[role="img"] svg')
Expected: visible
Error: strict mode violation: locator('[data-opf-renderer="0.9.0"] div[role="img"] svg') resolved to 5 elements:
    1) <svg role="img" height="720" width="1280" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" aria-label="Presentations should be programmable, not handcrafted bottlenecks.">…</svg> aka getByText('Seed round Presentations')
    2) <svg role="img" height="720" width="1280" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" aria-label="Deck production still breaks at the exact moment teams need speed.">…</svg> aka getByText('Deck production still breaks at the exact moment teams need speed. • Teams')
    3) <svg role="img" height="720" width="1280" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" aria-label="OPF makes every deck step speak the same contract.">…</svg> aka getByText('OPF makes every deck step speak the same contract. Describe the presentation')
    4) <svg role="img" height="720" width="1280" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" aria-label="Developer demand is moving from exports to full deck systems.">…</svg> aka getByText('Developer demand is moving from exports to full deck systems. Qualified')
    5) <svg role="img" height="720" width="1280" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" aria-label="We are raising to make OPF the default contract for AI-generated presentations.">…</svg> aka locator('svg').filter({ hasText: 'We are raising to make OPF' })

Call log:
  - Expect "toBeVisible" locator('[data-opf-renderer="0.9.0"] div[role="img"] svg') with timeout 5000ms
  - waiting for locator('[data-opf-renderer="0.9.0"] div[role="img"] svg')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "P pptx.dev" [ref=e5] [cursor=pointer]:
          - /url: /
          - generic [ref=e6]: P
          - generic [ref=e8]: pptx.dev
        - generic [ref=e9]:
          - link "Author" [ref=e10] [cursor=pointer]:
            - /url: /author
          - link "Inspector" [ref=e11] [cursor=pointer]:
            - /url: /inspector
          - link "Decoder" [ref=e12] [cursor=pointer]:
            - /url: /decoder
          - link "Docs" [ref=e13] [cursor=pointer]:
            - /url: /docs
          - link "API" [ref=e14] [cursor=pointer]:
            - /url: /docs/api
          - link "OPF" [ref=e15] [cursor=pointer]:
            - /url: /docs/opf
          - link "pptx.gallery" [ref=e16] [cursor=pointer]:
            - /url: https://pptx.gallery
          - link "Get Started" [ref=e17] [cursor=pointer]:
            - /url: /sign-up
    - main [ref=e18]:
      - generic [ref=e19]:
        - heading "OPF Inspector" [level=1] [ref=e20]
        - generic [ref=e21]:
          - generic [ref=e22]:
            - generic [ref=e23]: Inspector
            - generic [ref=e31]:
              - generic [ref=e32]: Browser adoption check
              - generic "Schema valid" [ref=e33]: Valid
            - generic [ref=e35]:
              - tablist "Editor format" [ref=e36]:
                - tab "JSON" [selected] [ref=e37]
                - tab "YAML" [ref=e38]
                - tab "MD" [ref=e39]
              - generic [ref=e40]:
                - generic [ref=e41]: Templates
                - combobox "Load a sample OPF template" [ref=e42]:
                  - option "Custom deck" [selected]
                  - option "Pitch · 5 slides"
                  - option "QBR · 4 slides"
                  - option "Sales · 4 slides"
                  - option "Tech Talk · 4 slides"
              - button "Copy" [ref=e43]
              - button "Share" [ref=e48]
              - button "json" [ref=e56]
              - button "pptx" [ref=e61]
              - button "More actions" [ref=e66]
          - main [ref=e68]:
            - complementary [ref=e69]:
              - generic [ref=e71]:
                - generic [ref=e72]:
                  - generic [ref=e73]: OPF v1 schema
                  - paragraph [ref=e79]: Flat top-level keys in spec order.
                - generic [ref=e80]: "20"
              - generic [ref=e82]:
                - button "unset $schema unset Canonical OPF schema URI. uri" [ref=e83]:
                  - generic [ref=e84]:
                    - generic [ref=e85]:
                      - generic [ref=e86]:
                        - generic [ref=e87]: unset
                        - generic [ref=e88]: $schema
                        - generic "$schema is not authored in this OPF document." [ref=e89]: unset
                      - generic [ref=e90]: Canonical OPF schema URI.
                    - generic "uri" [ref=e92]
                - button "string name \"Browser adoption check\" Deck identity used by exports and share previews. string" [ref=e93]:
                  - generic [ref=e94]:
                    - generic [ref=e95]:
                      - generic [ref=e96]:
                        - generic [ref=e97]: string
                        - generic [ref=e98]: name
                        - generic "Browser adoption check" [ref=e99]: "\"Browser adoption check\""
                      - generic [ref=e100]: Deck identity used by exports and share previews.
                    - generic "string" [ref=e102]
                - button "unset description unset Short deck summary for humans and agents. string" [ref=e103]:
                  - generic [ref=e104]:
                    - generic [ref=e105]:
                      - generic [ref=e106]:
                        - generic [ref=e107]: unset
                        - generic [ref=e108]: description
                        - generic "description is not authored in this OPF document." [ref=e109]: unset
                      - generic [ref=e110]: Short deck summary for humans and agents.
                    - generic "string" [ref=e112]
                - button "unset filename unset Preferred export filename before extension normalization. string" [ref=e113]:
                  - generic [ref=e114]:
                    - generic [ref=e115]:
                      - generic [ref=e116]:
                        - generic [ref=e117]: unset
                        - generic [ref=e118]: filename
                        - generic "filename is not authored in this OPF document." [ref=e119]: unset
                      - generic [ref=e120]: Preferred export filename before extension normalization.
                    - generic "string" [ref=e122]
                - group [ref=e123]:
                  - generic "unset organization unset One organization or an array of organizations. oneOf Organization | Organization[]" [ref=e124] [cursor=pointer]:
                    - generic [ref=e125]:
                      - generic [ref=e126]:
                        - generic [ref=e127]:
                          - generic [ref=e128]: unset
                          - generic [ref=e129]: organization
                          - generic "organization is not authored in this OPF document." [ref=e130]: unset
                        - generic [ref=e131]: One organization or an array of organizations.
                      - generic "oneOf Organization | Organization[]" [ref=e133]
                - group [ref=e136]:
                  - generic "unset speaker unset One speaker or a panel of speakers. oneOf Speaker | Speaker[]" [ref=e137] [cursor=pointer]:
                    - generic [ref=e138]:
                      - generic [ref=e139]:
                        - generic [ref=e140]:
                          - generic [ref=e141]: unset
                          - generic [ref=e142]: speaker
                          - generic "speaker is not authored in this OPF document." [ref=e143]: unset
                        - generic [ref=e144]: One speaker or a panel of speakers.
                      - generic "oneOf Speaker | Speaker[]" [ref=e146]
                - button "unset author unset Author attribution for the document. string | object" [ref=e149]:
                  - generic [ref=e150]:
                    - generic [ref=e151]:
                      - generic [ref=e152]:
                        - generic [ref=e153]: unset
                        - generic [ref=e154]: author
                        - generic "author is not authored in this OPF document." [ref=e155]: unset
                      - generic [ref=e156]: Author attribution for the document.
                    - generic "string | object" [ref=e158]
                - button "unset audience unset Audience profile or catalog reference. string | string[] | Audience" [ref=e159]:
                  - generic [ref=e160]:
                    - generic [ref=e161]:
                      - generic [ref=e162]:
                        - generic [ref=e163]: unset
                        - generic [ref=e164]: audience
                        - generic "audience is not authored in this OPF document." [ref=e165]: unset
                      - generic [ref=e166]: Audience profile or catalog reference.
                    - generic "string | string[] | Audience" [ref=e168]
                - button "unset purpose unset The job the deck needs to do. string" [ref=e169]:
                  - generic [ref=e170]:
                    - generic [ref=e171]:
                      - generic [ref=e172]:
                        - generic [ref=e173]: unset
                        - generic [ref=e174]: purpose
                        - generic "purpose is not authored in this OPF document." [ref=e175]: unset
                      - generic [ref=e176]: The job the deck needs to do.
                    - generic "string" [ref=e178]
                - button "unset language unset Language code or catalog language reference. string | Language" [ref=e179]:
                  - generic [ref=e180]:
                    - generic [ref=e181]:
                      - generic [ref=e182]:
                        - generic [ref=e183]: unset
                        - generic [ref=e184]: language
                        - generic "language is not authored in this OPF document." [ref=e185]: unset
                      - generic [ref=e186]: Language code or catalog language reference.
                    - generic "string | Language" [ref=e188]
                - group [ref=e189]:
                  - generic "unset tone unset Voice and delivery style applied across copy. oneOf string | Tone" [ref=e190] [cursor=pointer]:
                    - generic [ref=e191]:
                      - generic [ref=e192]:
                        - generic [ref=e193]:
                          - generic [ref=e194]: unset
                          - generic [ref=e195]: tone
                          - generic "tone is not authored in this OPF document." [ref=e196]: unset
                        - generic [ref=e197]: Voice and delivery style applied across copy.
                      - generic "oneOf string | Tone" [ref=e199]
                - button "unset takeaway unset Primary idea the audience should retain. string" [ref=e202]:
                  - generic [ref=e203]:
                    - generic [ref=e204]:
                      - generic [ref=e205]:
                        - generic [ref=e206]: unset
                        - generic [ref=e207]: takeaway
                        - generic "takeaway is not authored in this OPF document." [ref=e208]: unset
                      - generic [ref=e209]: Primary idea the audience should retain.
                    - generic "string" [ref=e211]
                - button "unset duration unset Target presentation duration. number | string" [ref=e212]:
                  - generic [ref=e213]:
                    - generic [ref=e214]:
                      - generic [ref=e215]:
                        - generic [ref=e216]: unset
                        - generic [ref=e217]: duration
                        - generic "duration is not authored in this OPF document." [ref=e218]: unset
                      - generic [ref=e219]: Target presentation duration.
                    - generic "number | string" [ref=e221]
                - button "unset tags unset Search and workflow tags. string[]" [ref=e222]:
                  - generic [ref=e223]:
                    - generic [ref=e224]:
                      - generic [ref=e225]:
                        - generic [ref=e226]: unset
                        - generic [ref=e227]: tags
                        - generic "tags is not authored in this OPF document." [ref=e228]: unset
                      - generic [ref=e229]: Search and workflow tags.
                    - generic "string[]" [ref=e231]
                - group [ref=e232]:
                  - generic "unset design unset Global visual system for every slide. Design" [ref=e233] [cursor=pointer]:
                    - generic [ref=e234]:
                      - generic [ref=e235]:
                        - generic [ref=e236]:
                          - generic [ref=e237]: unset
                          - generic [ref=e238]: design
                          - generic "design is not authored in this OPF document." [ref=e239]: unset
                        - generic [ref=e240]: Global visual system for every slide.
                      - generic "Design" [ref=e242]
                - group [ref=e245]:
                  - generic "unset narrative unset Story arc and beat structure. oneOf string | Narrative" [ref=e246] [cursor=pointer]:
                    - generic [ref=e247]:
                      - generic [ref=e248]:
                        - generic [ref=e249]:
                          - generic [ref=e250]: unset
                          - generic [ref=e251]: narrative
                          - generic "narrative is not authored in this OPF document." [ref=e252]: unset
                        - generic [ref=e253]: Story arc and beat structure.
                      - generic "oneOf string | Narrative" [ref=e255]
                - group [ref=e258]:
                  - generic "array slides [1 item] Required ordered slide array, minimum one item. required Slide[]" [ref=e259] [cursor=pointer]:
                    - generic [ref=e260]:
                      - generic [ref=e261]:
                        - generic [ref=e262]:
                          - generic [ref=e263]: array
                          - generic [ref=e264]: slides
                          - generic "[1 item]" [ref=e265]
                        - generic [ref=e266]: Required ordered slide array, minimum one item.
                      - generic [ref=e267]:
                        - generic [ref=e268]: required
                        - generic "Slide[]" [ref=e269]
                - group [ref=e272]:
                  - generic "unset assets unset Asset map referenced by asset:<id> strings. Record<string, string | Asset>" [ref=e273] [cursor=pointer]:
                    - generic [ref=e274]:
                      - generic [ref=e275]:
                        - generic [ref=e276]:
                          - generic [ref=e277]: unset
                          - generic [ref=e278]: assets
                          - generic "assets is not authored in this OPF document." [ref=e279]: unset
                        - generic [ref=e280]: Asset map referenced by asset:<id> strings.
                      - generic "Record<string, string | Asset>" [ref=e282]
                - group [ref=e285]:
                  - generic "unset catalogs unset Catalog overrides for gallery-backed choices. Record<CatalogKind, CatalogEntry>" [ref=e286] [cursor=pointer]:
                    - generic [ref=e287]:
                      - generic [ref=e288]:
                        - generic [ref=e289]:
                          - generic [ref=e290]: unset
                          - generic [ref=e291]: catalogs
                          - generic "catalogs is not authored in this OPF document." [ref=e292]: unset
                        - generic [ref=e293]: Catalog overrides for gallery-backed choices.
                      - generic "Record<CatalogKind, CatalogEntry>" [ref=e295]
                - button "unset extensions unset Namespaced vendor or workflow extensions. object" [ref=e298]:
                  - generic [ref=e299]:
                    - generic [ref=e300]:
                      - generic [ref=e301]:
                        - generic [ref=e302]: unset
                        - generic [ref=e303]: extensions
                        - generic "extensions is not authored in this OPF document." [ref=e304]: unset
                      - generic [ref=e305]: Namespaced vendor or workflow extensions.
                    - generic "object" [ref=e307]
              - generic [ref=e309]:
                - generic [ref=e310]: Validation
                - generic [ref=e311]: 0e 0w
            - generic [ref=e312]:
              - generic [ref=e313]:
                - generic [ref=e314]: deck.opf.json
                - generic [ref=e321]: Schema clean
              - code [ref=e325]:
                - generic [ref=e326]:
                  - textbox "Editor content" [active] [ref=e327]
                  - textbox [aria-hidden] [ref=e328]
                  - generic [aria-hidden] [ref=e330]:
                    - generic [ref=e331]:
                      - generic [ref=e332] [cursor=pointer]: 
                      - generic [ref=e333]: "1"
                    - generic [ref=e334]: "2"
                    - generic [ref=e336]:
                      - generic [ref=e337] [cursor=pointer]: 
                      - generic [ref=e338]: "3"
                    - generic [ref=e339]:
                      - generic [ref=e340] [cursor=pointer]: 
                      - generic [ref=e341]: "4"
                    - generic [ref=e342]: "5"
                    - generic [ref=e344]: "6"
                    - generic [ref=e346]: "7"
                    - generic [ref=e348]: "8"
                    - generic [ref=e350]: "9"
                  - generic [aria-hidden] [ref=e379]:
                    - generic [ref=e380]: "{"
                    - generic [ref=e382]: "\"name\": \"Browser adoption check\","
                    - generic [ref=e384]: "\"slides\": ["
                    - generic [ref=e386]: "{"
                    - generic [ref=e388]: "\"title\": \"An editable presentation\","
                    - generic [ref=e390]: "\"text\": \"Written in the browser.\""
                    - generic [ref=e392]: "}"
                    - generic [ref=e394]: "]"
                    - generic [ref=e396]: "}"
              - generic [ref=e400]:
                - generic [ref=e401]:
                  - generic [ref=e402]:
                    - generic [ref=e406]: Resolves to
                    - code [ref=e407]: name
                  - generic [ref=e408]: authored / catalog / default / inherited
                - generic [ref=e410]:
                  - generic [ref=e411]:
                    - term [ref=e412]:
                      - generic [ref=e413]: authored value
                      - generic [ref=e414]: authored
                    - definition [ref=e415]: "\"Browser adoption check\""
                  - generic [ref=e416]:
                    - term [ref=e417]:
                      - generic [ref=e418]: filename fallback
                      - generic [ref=e419]: default
                    - definition [ref=e420]: Browser adoption check
            - complementary [ref=e421]:
              - generic [ref=e423]:
                - generic [ref=e424]:
                  - generic [ref=e425]: Contextual gallery
                  - heading "name" [level=2] [ref=e429]
                  - paragraph [ref=e430]: Deck identity used by exports and share previews.
                - button "Pin gallery context" [ref=e431]: Pin
              - generic [ref=e434]:
                - generic [ref=e436]:
                  - generic [ref=e437]:
                    - heading "Suggestions" [level=3] [ref=e438]
                    - paragraph [ref=e439]: Resolution hints for the selected OPF path
                  - generic [ref=e440]: 2 cards
                - generic [ref=e441]:
                  - generic [ref=e442]: Sources
                  - generic [ref=e444]:
                    - generic [ref=e445]: authored
                    - generic [ref=e446]: catalog
                    - generic [ref=e447]: default
                    - generic [ref=e448]: inherited
                - generic [ref=e450]:
                  - generic [ref=e451]:
                    - generic [ref=e452]: Identity
                    - generic [ref=e453]: Deck name resolves into exports
                    - paragraph [ref=e454]: Current authored value is "Browser adoption check". This field names the OPF document without becoming slide copy.
                    - code [ref=e455]: name
                  - generic [ref=e456]:
                    - generic [ref=e457]: Filename
                    - generic [ref=e458]: Download fallback
                    - paragraph [ref=e459]: PPTX export uses filename when authored, then falls back to the deck name.
                    - code [ref=e460]: Browser adoption check
                  - generic [ref=e461]:
                    - generic [ref=e462]:
                      - generic [ref=e463]: Selected path
                      - generic [ref=e464]: Root
                    - code [ref=e465]: name
                    - paragraph [ref=e466]: Document-level context for the active OPF buffer.
                    - generic "$" [ref=e468]
                  - generic [ref=e475]:
                    - paragraph [ref=e476]: Schema validation passed
                    - paragraph [ref=e477]: 0 errors, 0 warnings
                - generic [ref=e481]:
                  - paragraph [ref=e482]: Does not render on slides; controls deck identity and filename.
                  - paragraph [ref=e483]: "#/properties/name"
              - generic [ref=e485]:
                - generic [ref=e486]:
                  - generic [ref=e487]: Slide preview
                  - generic [ref=e488]: 1 slide
                - figure "Slide 1" [ref=e492]:
                  - generic [ref=e493]:
                    - generic [ref=e494]:
                      - img [ref=e496]:
                        - img [ref=e497]:
                          - generic [ref=e499]: An editable presentation
                          - generic [ref=e501]: Written in the browser.
                      - 'group "Slide 1: An editable presentation" [ref=e504]':
                        - group "Editable slide" [ref=e507]:
                          - 'button "Edit title: An editable presentation" [ref=e509]':
                            - generic [ref=e511]: An editable presentation
                          - 'button "Edit text: Written in the browser." [ref=e512]':
                            - generic [ref=e514]: Written in the browser.
                    - group [ref=e515]:
                      - generic "Preview notes (2)" [ref=e516]
          - generic [ref=e519]:
            - generic [ref=e520]:
              - generic [ref=e521]: name
              - generic [ref=e522]: string
              - generic [ref=e523]: "#/properties/name"
            - generic [ref=e524]:
              - generic [ref=e525]: JSON
              - generic [ref=e526]: 0 errors / 0 warnings
              - generic [ref=e527]: cursor root
  - alert [ref=e528]
  - generic [ref=e529]:
    - alert
    - alert
```

# Test source

```ts
  15  |   const {fromPptx} = await import('@openpresentation/opf-pptx');
  16  |   const {validatePresentation} = await import('@openpresentation/opf');
  17  |   const require = createRequire(path.resolve('package.json'));
  18  |   const JSZip = createRequire(require.resolve('@openpresentation/opf-pptx'))('jszip');
  19  |   for(const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
  20  |     const deck = {design:{fontScheme:'roboto',dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{title,quote:{text:'A shared layout keeps the evidence readable when the words change. '.repeat(24),attribution:'A reviewer',source:'Recorded interview'}}]};
  21  |     await page.goto('/inspector#opf='+gzipSync(JSON.stringify(deck)).toString('base64url'));
  22  |     const svg = page.locator(`${rendererSelector} svg`);
  23  |     await expect(svg).toBeVisible({timeout:20_000});
  24  |     await expect(svg).toHaveAttribute('viewBox',`0 0 ${dimensions.width} ${dimensions.height}`);
  25  |     const bounds = await svg.evaluate((svg,{title,footer})=>{
  26  |       const texts=[...svg.querySelectorAll('text')];
  27  |       const source=texts.find(node=>node.textContent===footer);
  28  |       const body=texts.filter(node=>node!==source&&node.textContent!==title);
  29  |       return {bodyLines:body.length,bodyBottom:Math.max(...body.map(node=>node.getBBox().y+node.getBBox().height)),footerTop:source?.getBBox().y};
  30  |     },{title,footer});
  31  |     expect(bounds.bodyLines).toBeGreaterThan(1);
  32  |     expect(bounds.footerTop).toBeDefined();
  33  |     expect(bounds.bodyBottom).toBeLessThanOrEqual(bounds.footerTop!);
  34  |     const pending = page.waitForEvent('download');
  35  |     await page.getByRole('button',{name:'pptx',exact:true}).click();
  36  |     const download = await pending;
  37  |     expect(await download.failure()).toBeNull();
  38  |     const bytes = await readFile((await download.path())!);
  39  |     const restored = await fromPptx(bytes);
  40  |     expect(validatePresentation(restored).valid).toBe(true);
  41  |     expect(JSON.stringify(restored)).toContain(footer);
  42  |     const archive = await JSZip.loadAsync(bytes);
  43  |     const xml = await archive.file('ppt/slides/slide1.xml').async('string');
  44  |     const native = await page.evaluate(({xml,title,footer})=>{
  45  |       const document=new DOMParser().parseFromString(xml,'application/xml');
  46  |       const shapes=[...document.getElementsByTagName('p:sp')].filter(shape=>shape.getElementsByTagName('a:t').length);
  47  |       const text=(shape:Element)=>[...shape.getElementsByTagName('a:t')].map(node=>node.textContent).join('');
  48  |       const source=shapes.find(shape=>text(shape)===footer);
  49  |       const body=shapes.filter(shape=>shape!==source&&text(shape)!==title);
  50  |       const bounds=(shape:Element)=>{const transform=shape.getElementsByTagName('a:xfrm')[0];return {top:Number(transform.getElementsByTagName('a:off')[0].getAttribute('y')),height:Number(transform.getElementsByTagName('a:ext')[0].getAttribute('cy'))};};
  51  |       return {bodyLines:body.length,bodyBottom:Math.max(...body.map(shape=>{const box=bounds(shape);return box.top+box.height;})),footerTop:source?bounds(source).top:null};
  52  |     },{xml,title,footer});
  53  |     expect(native.bodyLines).toBeGreaterThan(1);
  54  |     expect(native.footerTop).not.toBeNull();
  55  |     expect(native.bodyBottom).toBeLessThanOrEqual(native.footerTop!);
  56  |   }
  57  |   expect(errors).toEqual([]);
  58  | });
  59  | 
  60  | const fixture = {
  61  |   name: "Browser adoption check",
  62  |   slides: [{ title: "An editable presentation", text: "Written in the browser." }],
  63  | };
  64  | 
  65  | test('shared navigation clears format errors and proposals from the previous deck', async ({page}) => {
  66  |   const href = (doc: unknown) => '/inspector#opf=' + gzipSync(JSON.stringify(doc)).toString('base64url');
  67  |   await page.goto(href({slides:[{title:'Original deck'}]}));
  68  |   const input = page.getByRole('textbox', {name:'Editor content'});
  69  |   await expect(input).toBeVisible();
  70  |   await page.locator('[data-schema-path="name"]').click();
  71  |   await expect(page.getByTestId('opf-ghost-proposal')).toBeVisible();
  72  |   await page.keyboard.press('Escape');
  73  |   await expect(page.getByTestId('opf-ghost-proposal')).toHaveCount(0);
  74  |   await page.locator('[data-schema-path="name"]').click();
  75  |   await expect(page.getByTestId('opf-ghost-proposal')).toBeVisible();
  76  |   await page.goto(href(fixture));
  77  |   await expect(page.getByTestId('playground-gallery-rail')).toContainText(fixture.slides[0].title);
  78  |   await expect(page.getByTestId('opf-ghost-proposal')).toHaveCount(0);
  79  | 
  80  |   await input.focus();
  81  |   await page.keyboard.press('ControlOrMeta+a');
  82  |   await page.keyboard.insertText('{');
  83  |   await page.getByRole('tab', {name:'YAML', exact:true}).click();
  84  |   await expect(page.getByText('Format error', {exact:true})).toBeVisible();
  85  |   await page.goto(href({slides:[{title:'Clean replacement'}]}));
  86  |   await expect(page.getByTestId('playground-gallery-rail')).toContainText('Clean replacement');
  87  |   await expect(page.getByText('Format error', {exact:true})).toHaveCount(0);
  88  |   await expect(page.getByText('Schema clean', {exact:true})).toBeVisible();
  89  | });
  90  | 
  91  | async function downloadOpf(page: Page) {
  92  |   const pending = page.waitForEvent("download");
  93  |   await page.getByRole("button", { name: "json", exact: true }).click();
  94  |   const download = await pending;
  95  |   expect(download.suggestedFilename()).toMatch(/\.opf\.json$/);
  96  |   return JSON.parse(await readFile((await download.path())!, "utf8"));
  97  | }
  98  | 
  99  | async function replaceBuffer(page: Page, document: unknown) {
  100 |   const input = page.getByRole("textbox", { name: "Editor content" });
  101 |   await input.focus();
  102 |   await page.keyboard.press("ControlOrMeta+a");
  103 |   await page.evaluate((text) => navigator.clipboard.writeText(text), JSON.stringify(document, null, 2));
  104 |   await page.keyboard.press("ControlOrMeta+v");
  105 | }
  106 | 
  107 | test("anonymous JSON authoring, preview, undo/redo, download and shared reimport", async ({ page }) => {
  108 |   const errors: string[] = [];
  109 |   page.on("pageerror", (error) => errors.push(error.message));
  110 |   await page.goto("/inspector");
  111 |   await expect(page.getByTestId("playground-pattern-b-shell")).toBeVisible();
  112 |   await expect(page.locator(".monaco-editor").first()).toBeVisible();
  113 |   await replaceBuffer(page, fixture);
  114 |   await expect(page.getByTestId("playground-gallery-rail")).toContainText(fixture.slides[0].title);
> 115 |   await expect(page.locator(`${rendererSelector} svg`)).toBeVisible();
      |                                                         ^ Error: expect(locator).toBeVisible() failed
  116 |   await expect(page.getByTestId("playground-status-bar")).toContainText("0 errors / 0 warnings");
  117 |   expect(await downloadOpf(page)).toEqual(fixture);
  118 | 
  119 |   // A single keyboard edit must be reflected in the authored buffer and undo history.
  120 |   const edited = { ...fixture, name: "Edited browser presentation" };
  121 |   await replaceBuffer(page, edited);
  122 |   await expect.poll(() => downloadOpf(page)).toEqual(edited);
  123 |   await page.getByRole("textbox", { name: "Editor content" }).focus();
  124 |   await page.keyboard.press("ControlOrMeta+z");
  125 |   await expect.poll(() => downloadOpf(page)).toEqual(fixture);
  126 |   await page.getByRole("textbox", { name: "Editor content" }).focus();
  127 |   await page.keyboard.press("ControlOrMeta+Shift+z");
  128 |   await expect.poll(() => downloadOpf(page)).toEqual(edited);
  129 | 
  130 |   const encoded = gzipSync(JSON.stringify(edited)).toString("base64url");
  131 |   await page.goto(`/inspector#opf=${encoded}`);
  132 |   await expect(page.getByTestId("playground-pattern-b-shell")).toContainText(edited.name);
  133 |   expect(await downloadOpf(page)).toEqual(edited);
  134 |   await expect(page.getByTestId("playground-gallery-rail")).toContainText(fixture.slides[0].title);
  135 |   await expect(page.locator(`${rendererSelector} svg`)).toBeVisible();
  136 |   const apiWrites: string[] = [];
  137 |   page.on('request', request => { if (request.method() === 'POST') apiWrites.push(request.url()); });
  138 |   await page.context().setOffline(true);
  139 |   const pptxPending = page.waitForEvent('download');
  140 |   await page.getByRole('button', { name: 'pptx', exact: true }).click();
  141 |   const pptx = await pptxPending;
  142 |   expect(await pptx.failure()).toBeNull();
  143 |   const bytes = await readFile((await pptx.path())!);
  144 |   const { fromPptx } = await import('@openpresentation/opf-pptx');
  145 |   const { validatePresentation } = await import('@openpresentation/opf');
  146 |   const converted = await fromPptx(bytes);
  147 |   expect(validatePresentation(converted).valid).toBe(true);
  148 |   expect(JSON.stringify(converted)).toContain(fixture.slides[0].title);
  149 |   expect(apiWrites).toEqual([]);
  150 |   expect(errors).toEqual([]);
  151 |   await page.screenshot({ path: test.info().outputPath("inspector.png"), fullPage: true });
  152 | });
  153 | 
```