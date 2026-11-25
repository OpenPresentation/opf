-- Keynote 16.0 actions for kn-run, kn-close and kn-edit. One action per osascript call, so the caller can time and watch each one.
-- Do not run it by hand unless kn-run's guards hold (Keynote running, screen unlocked, no foreign documents).
-- Never saves, never quits Keynote, closes only the document id it is given.
--
--   osascript kn.applescript docs                                  -> one line per open document: id<TAB>name<TAB>file path
--   osascript kn.applescript open <in.pptx> <timeout-s>            -> OPENED<TAB>id<TAB>slide count   |  TIMEOUT / ERROR<TAB>message
--   osascript kn.applescript info <id>                             -> slide count<TAB>skipped slide numbers (comma separated)
--   osascript kn.applescript probe <id> <out.lines>                -> writes the probe as lines (path<TAB>type<TAB>value), kn-run turns it into probe.json
--   osascript kn.applescript slides <id> <out-dir> <yes|no>        -> export slide images (PNG) into <out-dir>; yes = include skipped slides
--   osascript kn.applescript pptx <id> <out.pptx>                  -> export as Microsoft PowerPoint
--   osascript kn.applescript close <id>                            -> close saving no; prints CLOSED or GONE
--
-- Gotchas kept from the earlier rounds: POSIX file values are built outside the tell block (else Keynote's sandbox says the file
-- "can't be imported"); export ... as slide images empties its target folder; skipped slides are exported only with skipped slides:true.
-- Keynote 16.0 quirks found while writing this (see SDEF-NOTES.md): `every shape` / `every text item` misreport the title placeholder,
-- so items are always addressed as `iWork item i`; `properties of every iWork item` is one Apple event per container.

property L : {}
property outPath : ""

on rep(t, a, b)
	set AppleScript's text item delimiters to a
	set parts to text items of t
	set AppleScript's text item delimiters to b
	set r to parts as text
	set AppleScript's text item delimiters to ""
	return r
end rep

on esc(t)
	set t to my rep(t, "\\", "\\\\")
	set t to my rep(t, tab, "\\t")
	set t to my rep(t, linefeed, "\\n")
	set t to my rep(t, return, "\\r")
	set t to my rep(t, (character id 8232), "\\u2028")
	set t to my rep(t, (character id 8233), "\\u2029")
	return t
end esc

on add(p, k, v)
	set end of L to p & tab & k & tab & my esc(v)
end add

-- Values are coerced inside a Keynote tell block so enumerations come out as their dictionary names ("no fill"), not codes.
on emit(p, v)
	if v is missing value then
		my add(p, "null", "")
		return
	end if
	set k to class of v
	if k is boolean then
		my add(p, "b", v as text)
	else if k is integer or k is real then
		my add(p, "n", v as text)
	else if k is list then
		my add(p, "list", (count of v) as text)
		repeat with i from 1 to count of v
			my emit(p & "/#" & (i - 1), item i of v)
		end repeat
	else if k is text or k is string or k is Unicode text then
		my add(p, "s", v)
	else
		try
			tell application id "com.apple.Keynote" to set s to v as text
			my add(p, "e", s)
		on error
			try
				my add(p, "e", (k as text))
			on error
				my add(p, "e", "?")
			end try
		end try
	end if
end emit

on fail(p, m, n)
	my add(p, "err", (n as text) & " " & m)
end fail

on flush()
	if (count of L) is 0 then return
	set AppleScript's text item delimiters to linefeed
	set t to (L as text) & linefeed
	set AppleScript's text item delimiters to ""
	set fh to open for access (POSIX file outPath) with write permission
	write t to fh starting at eof as «class utf8»
	close access fh
	set L to {}
end flush

-- Read one field of a record returned by `properties`; absent fields are skipped silently (they do not apply to that class).
on fld(p, rec, nm)
	try
		tell application id "com.apple.Keynote"
			if nm is "position" then
				set v to position of rec
			else if nm is "width" then
				set v to width of rec
			else if nm is "height" then
				set v to height of rec
			else if nm is "rotation" then
				set v to rotation of rec
			else if nm is "opacity" then
				set v to opacity of rec
			else if nm is "reflection showing" then
				set v to reflection showing of rec
			else if nm is "reflection value" then
				set v to reflection value of rec
			else if nm is "locked" then
				set v to locked of rec
			else if nm is "background fill type" then
				set v to background fill type of rec
			else if nm is "object text" then
				set v to object text of rec
			else if nm is "description" then
				set v to description of rec
			else if nm is "file name" then
				set v to file name of rec
			else if nm is "start point" then
				set v to start point of rec
			else if nm is "end point" then
				set v to end point of rec
			else if nm is "name" then
				set v to name of rec
			else if nm is "row count" then
				set v to row count of rec
			else if nm is "column count" then
				set v to column count of rec
			else if nm is "header row count" then
				set v to header row count of rec
			else if nm is "header column count" then
				set v to header column count of rec
			else if nm is "footer row count" then
				set v to footer row count of rec
			else if nm is "movie volume" then
				set v to movie volume of rec
			else if nm is "clip volume" then
				set v to clip volume of rec
			else if nm is "repetition method" then
				set v to repetition method of rec
			end if
		end tell
	on error number n
		if n is -1728 or n is -1700 then return
		error number n
	end try
	my emit(p & "/" & nm, v)
end fld

-- Per paragraph: text, font, size, color (the dictionary has no runs, alignment, spacing, bullets, direction or links);
-- per item: the distinct fonts and sizes of its words (to see mixed runs).
on probeText(p, itm)
	try
		tell application id "com.apple.Keynote" to set ps to every paragraph of object text of itm
	on error m number n
		my fail(p & "/paragraphs", m, n)
		return
	end try
	set np to count of ps
	my add(p & "/paragraphCount", "n", np as text)
	if np is 0 then return
	set fs to {}
	set ss to {}
	set cs to {}
	try
		tell application id "com.apple.Keynote" to set fs to font of every paragraph of object text of itm
	on error m number n
		my fail(p & "/paragraphs/font", m, n)
	end try
	try
		tell application id "com.apple.Keynote" to set ss to size of every paragraph of object text of itm
	on error m number n
		my fail(p & "/paragraphs/size", m, n)
	end try
	try
		tell application id "com.apple.Keynote" to set cs to color of every paragraph of object text of itm
	on error m number n
		my fail(p & "/paragraphs/color", m, n)
	end try
	if np > 200 then set np to 200
	repeat with j from 1 to np
		set q to p & "/paragraphs/#" & (j - 1)
		my emit(q & "/text", item j of ps)
		if (count of fs) ≥ j then my emit(q & "/font", item j of fs)
		if (count of ss) ≥ j then my emit(q & "/size", item j of ss)
		if (count of cs) ≥ j then my emit(q & "/color", item j of cs)
	end repeat
	try
		tell application id "com.apple.Keynote" to set v to font of every word of object text of itm
		my emit(p & "/wordFonts", my distinct(v))
	on error m number n
		my fail(p & "/wordFonts", m, n)
	end try
	try
		tell application id "com.apple.Keynote" to set v to size of every word of object text of itm
		my emit(p & "/wordSizes", my distinct(v))
	on error m number n
		my fail(p & "/wordSizes", m, n)
	end try
end probeText

on distinct(lst)
	set r to {}
	repeat with x in lst
		set x to contents of x
		if r does not contain {x} then set end of r to x
	end repeat
	return r
end distinct

on probeTable(p, tb)
	repeat with nm in {"value", "formatted value", "formula", "format", "alignment", "vertical alignment", "text color", "background color", "font name", "font size", "text wrap", "name"}
		set nm to contents of nm
		try
			tell application id "com.apple.Keynote"
				if nm is "value" then
					set v to value of every cell of tb
				else if nm is "formatted value" then
					set v to formatted value of every cell of tb
				else if nm is "formula" then
					set v to formula of every cell of tb
				else if nm is "format" then
					set v to format of every cell of tb
				else if nm is "alignment" then
					set v to alignment of every cell of tb
				else if nm is "vertical alignment" then
					set v to vertical alignment of every cell of tb
				else if nm is "text color" then
					set v to text color of every cell of tb
				else if nm is "background color" then
					set v to background color of every cell of tb
				else if nm is "font name" then
					set v to font name of every cell of tb
				else if nm is "font size" then
					set v to font size of every cell of tb
				else if nm is "text wrap" then
					set v to text wrap of every cell of tb
				else if nm is "name" then
					set v to name of every cell of tb
				end if
			end tell
			my emit(p & "/cells/" & nm, v)
		on error m number n
			my fail(p & "/cells/" & nm, m, n)
		end try
	end repeat
	try
		tell application id "com.apple.Keynote" to set v to height of every row of tb
		my emit(p & "/rowHeights", v)
	on error m number n
		my fail(p & "/rowHeights", m, n)
	end try
	try
		tell application id "com.apple.Keynote" to set v to width of every column of tb
		my emit(p & "/columnWidths", v)
	on error m number n
		my fail(p & "/columnWidths", m, n)
	end try
end probeTable

-- One property of one item read on its own (used when `properties` fails, e.g. an image's `file` throws -10000 in 16.0).
on one(p, itm, nm)
	try
		tell application id "com.apple.Keynote"
			if nm is "position" then
				set v to position of itm
			else if nm is "width" then
				set v to width of itm
			else if nm is "height" then
				set v to height of itm
			else if nm is "rotation" then
				set v to rotation of itm
			else if nm is "opacity" then
				set v to opacity of itm
			else if nm is "reflection showing" then
				set v to reflection showing of itm
			else if nm is "reflection value" then
				set v to reflection value of itm
			else if nm is "locked" then
				set v to locked of itm
			else if nm is "background fill type" then
				set v to background fill type of itm
			else if nm is "description" then
				set v to description of itm
			else if nm is "file name" then
				set v to file name of itm
			else if nm is "start point" then
				set v to start point of itm
			else if nm is "end point" then
				set v to end point of itm
			else if nm is "name" then
				set v to name of itm
			else if nm is "row count" then
				set v to row count of itm
			else if nm is "column count" then
				set v to column count of itm
			else if nm is "header row count" then
				set v to header row count of itm
			else if nm is "header column count" then
				set v to header column count of itm
			else if nm is "footer row count" then
				set v to footer row count of itm
			else if nm is "movie volume" then
				set v to movie volume of itm
			else if nm is "clip volume" then
				set v to clip volume of itm
			else if nm is "repetition method" then
				set v to repetition method of itm
			end if
		end tell
		my emit(p & "/" & nm, v)
	on error m number n
		my fail(p & "/" & nm, m, n)
	end try
end one

on propsFor(cls)
	set g to {"position", "width", "height", "locked"}
	if cls is "shape" or cls is "text item" then return g & {"rotation", "opacity", "reflection showing", "reflection value", "background fill type"}
	if cls is "image" then return g & {"rotation", "opacity", "reflection showing", "reflection value", "description", "file name"}
	if cls is "line" then return g & {"rotation", "reflection showing", "reflection value", "start point", "end point"}
	if cls is "group" then return g & {"rotation"}
	if cls is "table" then return g & {"name", "row count", "column count", "header row count", "header column count", "footer row count"}
	if cls is "movie" then return g & {"rotation", "opacity", "reflection showing", "reflection value", "file name", "movie volume", "repetition method"}
	if cls is "audio clip" then return g & {"file name", "clip volume", "repetition method"}
	return g
end propsFor

-- Every iWork item of a container (slide or group), in the container's order (back to front), with nesting for groups.
-- Fast path: `properties of every iWork item` (one Apple event). If that fails, per item `properties`, and if that fails too,
-- each property of the item's class on its own (`readMode` says which path was used).
on probeItems(p, cont, depth)
	set recs to missing value
	set mode to "bulk"
	try
		tell application id "com.apple.Keynote" to set recs to properties of every iWork item of cont
	on error
		set recs to missing value
	end try
	if recs is missing value then
		try
			tell application id "com.apple.Keynote" to set clss to class of every iWork item of cont
		on error m number n
			my fail(p & "/items", m, n)
			return
		end try
		set nItems to count of clss
	else
		set nItems to count of recs
	end if
	my add(p & "/itemCount", "n", nItems as text)
	repeat with i from 1 to nItems
		set q to p & "/items/#" & (i - 1)
		tell application id "com.apple.Keynote" to set itm to iWork item i of cont
		set rec to missing value
		if recs is not missing value then
			set rec to item i of recs
			set mode to "bulk"
		else
			try
				tell application id "com.apple.Keynote" to set rec to properties of itm
				set mode to "item"
			on error
				set rec to missing value
				set mode to "single"
			end try
		end if
		if rec is not missing value then
			tell application id "com.apple.Keynote" to set cls to (class of rec) as text
		else
			tell application id "com.apple.Keynote" to set cls to (item i of clss) as text
		end if
		my add(q & "/class", "s", cls)
		my add(q & "/depth", "n", depth as text)
		my add(q & "/readMode", "s", mode)
		set hasText to false
		if rec is not missing value then
			repeat with nm in {"position", "width", "height", "rotation", "opacity", "reflection showing", "reflection value", "locked", "background fill type", "description", "file name", "start point", "end point", "name", "row count", "column count", "header row count", "header column count", "footer row count", "movie volume", "clip volume", "repetition method"}
				my fld(q, rec, contents of nm)
			end repeat
			try
				tell application id "com.apple.Keynote" to set ot to object text of rec
				set hasText to true
				my emit(q & "/text", ot)
			end try
		else
			repeat with nm in my propsFor(cls)
				my one(q, itm, contents of nm)
			end repeat
			if cls is "shape" or cls is "text item" then
				try
					tell application id "com.apple.Keynote" to set ot to object text of itm
					set hasText to true
					my emit(q & "/text", ot as text)
				on error m number n
					my fail(q & "/text", m, n)
				end try
			end if
		end if
		if hasText then my probeText(q, itm)
		if cls is "group" then
			my probeItems(q, itm, depth + 1)
		else if cls is "table" then
			my probeTable(q, itm)
		end if
	end repeat
end probeItems

on probeDoc(theDoc)
	tell application id "com.apple.Keynote" to set ver to version
	my add("app/version", "s", ver)
	repeat with nm in {"name", "id", "width", "height", "slide numbers showing", "auto play", "auto loop", "auto restart", "maximum idle duration", "password protected"}
		set nm to contents of nm
		try
			tell application id "com.apple.Keynote"
				if nm is "name" then
					set v to name of theDoc
				else if nm is "id" then
					set v to id of theDoc
				else if nm is "width" then
					set v to width of theDoc
				else if nm is "height" then
					set v to height of theDoc
				else if nm is "slide numbers showing" then
					set v to slide numbers showing of theDoc
				else if nm is "auto play" then
					set v to auto play of theDoc
				else if nm is "auto loop" then
					set v to auto loop of theDoc
				else if nm is "auto restart" then
					set v to auto restart of theDoc
				else if nm is "maximum idle duration" then
					set v to maximum idle duration of theDoc
				else if nm is "password protected" then
					set v to password protected of theDoc
				end if
			end tell
			my emit("document/" & nm, v)
		on error m number n
			my fail("document/" & nm, m, n)
		end try
	end repeat
	try
		tell application id "com.apple.Keynote" to set v to name of document theme of theDoc
		my emit("document/theme", v)
	on error m number n
		my fail("document/theme", m, n)
	end try
	try
		tell application id "com.apple.Keynote" to set v to name of every slide layout of theDoc
		my emit("document/slide layouts", v)
	on error m number n
		my fail("document/slide layouts", m, n)
	end try
	try
		tell application id "com.apple.Keynote" to set srecs to properties of every slide of theDoc
	on error m number n
		my fail("slides", m, n)
		my flush()
		return
	end try
	set lays to {}
	set tts to {}
	set bts to {}
	set tps to {}
	set bps to {}
	try
		tell application id "com.apple.Keynote" to set lays to name of base layout of every slide of theDoc
	on error m number n
		my fail("slides/layout", m, n)
	end try
	try
		tell application id "com.apple.Keynote" to set tps to properties of default title item of every slide of theDoc
	on error m number n
		my fail("slides/default title item", m, n)
	end try
	try
		tell application id "com.apple.Keynote" to set bps to properties of default body item of every slide of theDoc
	on error m number n
		my fail("slides/default body item", m, n)
	end try
	my flush()
	set ns to count of srecs
	repeat with i from 1 to ns
		set p to "slides/#" & (i - 1)
		set r to item i of srecs
		tell application id "com.apple.Keynote"
			set s to slide i of theDoc
			set vals to {slide number of r, skipped of r, title showing of r, body showing of r, presenter notes of r}
			set tp to transition properties of r
			set tv to {(transition effect of tp) as text, transition duration of tp, transition delay of tp, automatic transition of tp}
		end tell
		set nms to {"slide number", "skipped", "title showing", "body showing", "presenter notes"}
		repeat with k from 1 to count of nms
			my emit(p & "/" & item k of nms, item k of vals)
		end repeat
		my emit(p & "/transition", tv)
		if (count of lays) ≥ i then my emit(p & "/layout", item i of lays)
		repeat with w in {{"default title item", tps}, {"default body item", bps}}
			set nm to item 1 of w
			set lst to item 2 of w
			if (count of lst) ≥ i then
				set rec to item i of lst
				repeat with f in {"position", "width", "height", "object text"}
					my fld(p & "/" & nm, rec, contents of f)
				end repeat
			end if
		end repeat
		my probeItems(p, s, 0)
		my flush()
	end repeat
end probeDoc

on docRef(docId)
	tell application id "com.apple.Keynote" to return document id docId
end docRef

on run argv
	set act to item 1 of argv
	if act is "docs" then
		set out to {}
		tell application id "com.apple.Keynote"
			repeat with d in (every document)
				set f to ""
				try
					set fl to file of d
					if fl is not missing value then set f to POSIX path of fl
				end try
				set end of out to (id of d) & tab & (name of d) & tab & f
			end repeat
		end tell
		set AppleScript's text item delimiters to linefeed
		return out as text
	else if act is "open" then
		set inFile to POSIX file (item 2 of argv)
		set t to (item 3 of argv) as integer
		set docId to ""
		set cnt to -1
		try
			with timeout of t seconds
				tell application id "com.apple.Keynote"
					set d to open inFile
					set docId to id of d
					set cnt to count of slides of d
				end tell
			end timeout
		on error errMsg number errNum
			if errNum is -1712 then return "TIMEOUT" & tab & "open timed out after " & t & " s" & tab & docId
			return "ERROR" & tab & "open failed: " & errNum & " " & errMsg & tab & docId
		end try
		return "OPENED" & tab & docId & tab & (cnt as text)
	else if act is "info" then
		set d to my docRef(item 2 of argv)
		tell application id "com.apple.Keynote"
			set n to count of slides of d
			set sk to skipped of every slide of d
		end tell
		set r to {}
		repeat with i from 1 to count of sk
			if item i of sk then set end of r to i as text
		end repeat
		set AppleScript's text item delimiters to ","
		set rs to r as text
		set AppleScript's text item delimiters to ""
		return (n as text) & tab & rs
	else if act is "probe" then
		set d to my docRef(item 2 of argv)
		set outPath to item 3 of argv
		set L to {}
		with timeout of 3600 seconds
			my probeDoc(d)
		end timeout
		my flush()
		return "PROBED"
	else if act is "slides" then
		set outFolder to POSIX file (item 3 of argv)
		set withSkipped to (item 4 of argv) is "yes"
		set d to my docRef(item 2 of argv)
		with timeout of 1800 seconds
			tell application id "com.apple.Keynote" to export d to outFolder as slide images with properties {image format:PNG, skipped slides:withSkipped}
		end timeout
		return "EXPORTED"
	else if act is "pptx" then
		set f to POSIX file (item 3 of argv)
		set d to my docRef(item 2 of argv)
		with timeout of 1800 seconds
			tell application id "com.apple.Keynote" to export d to f as Microsoft PowerPoint
		end timeout
		return "EXPORTED"
	else if act is "close" then
		set docId to item 2 of argv
		tell application id "com.apple.Keynote"
			if not (exists document id docId) then return "GONE"
			with timeout of 60 seconds
				close document id docId saving no
			end timeout
			if exists document id docId then return "STILL-OPEN"
		end tell
		return "CLOSED"
	end if
	error "unknown action " & act
end run
