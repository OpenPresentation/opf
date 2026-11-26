-- NT-02: the Keynote verbs of the native driver. One verb per osascript call, so driver.mjs can time each one and give it
-- its own timeout. Plain source text, run as `osascript keynote.applescript <verb> <args>`; nothing compiled is kept.
--
-- Run it only through driver.mjs: its check() makes sure Keynote is running (started by the owner), the screen is
-- unlocked and every open document is one the run opened. This script never starts or stops Keynote, never writes
-- a document back to disk, and closes only the document id it is given, with `saving no`.
--
--   info                                    -> "version<TAB>16.0", then "document<TAB><id><TAB><name>" per open document
--   open <posix path> [timeout s]           -> OPENED<TAB>id<TAB>slide count<TAB>skipped positions (1-based, comma separated)
--                                              TIMEOUT<TAB>id or empty<TAB>message / ERROR<TAB>id or empty<TAB>message
--   probe <document id> <lines file> [timeout s]   -> writes path<TAB>type<TAB>value lines (probe-lines.mjs reads them)
--   render <document id> <folder> [timeout s]      -> PNG picture of every slide that is not skipped, into <folder>
--   resave <document id> <file> [timeout s]        -> Keynote's own Microsoft PowerPoint copy
--   close <document id> [timeout s]                -> CLOSED, GONE or STILL-OPEN
--
-- Keynote 16.0 behavior this relies on (found in the 0.36.0 round):
-- - POSIX file values are built outside the tell block; inside it, Keynote's sandbox says the file "can't be imported".
-- - Items are always addressed as `iWork item i`: `every shape` and `every text item` misreport the title placeholder.
-- - `properties of every iWork item` fails (-10000) when any item is an image, because reading an image's file fails;
--   the probe then reads per item, and then each property of the item's class on its own (readMode bulk/item/single).
-- - Enumerations are coerced to text inside a Keynote tell block, so they come out as their names ("no fill").
-- - Exporting slide images empties the target folder and numbers the files among the exported slides only.
-- - A skipped slide reports slide number -1; positions, not slide numbers, identify slides.
-- - Error -1712 is an Apple event timeout; -1728 and -1700 mean a property does not apply to that class.

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

-- Appends the buffered lines to the lines file (once per slide, so a probe that stops part way leaves what it read).
on flush()
	if (count of L) is 0 then return
	set AppleScript's text item delimiters to linefeed
	set t to (L as text) & linefeed
	set AppleScript's text item delimiters to ""
	set fh to open for access (POSIX file outPath) with write permission
	try
		write t to fh starting at eof as «class utf8»
	on error m number n
		close access fh
		error m number n
	end try
	close access fh
	set L to {}
end flush

-- One property, either of a record that `properties` returned (rec) or of the item itself (one property, one event).
on pick(x, nm)
	tell application id "com.apple.Keynote"
		if nm is "position" then return position of x
		if nm is "width" then return width of x
		if nm is "height" then return height of x
		if nm is "rotation" then return rotation of x
		if nm is "opacity" then return opacity of x
		if nm is "reflection showing" then return reflection showing of x
		if nm is "reflection value" then return reflection value of x
		if nm is "locked" then return locked of x
		if nm is "background fill type" then return background fill type of x
		if nm is "object text" then return object text of x
		if nm is "description" then return description of x
		if nm is "file name" then return file name of x
		if nm is "start point" then return start point of x
		if nm is "end point" then return end point of x
		if nm is "name" then return name of x
		if nm is "row count" then return row count of x
		if nm is "column count" then return column count of x
		if nm is "header row count" then return header row count of x
		if nm is "header column count" then return header column count of x
		if nm is "footer row count" then return footer row count of x
		if nm is "movie volume" then return movie volume of x
		if nm is "clip volume" then return clip volume of x
		if nm is "repetition method" then return repetition method of x
	end tell
	error "unknown property " & nm number -1728
end pick

-- A field of a `properties` record: a field the class does not have is left out silently.
on fld(p, rec, nm)
	try
		set v to my pick(rec, nm)
	on error m number n
		if n is -1728 or n is -1700 then return
		my fail(p & "/" & nm, m, n)
		return
	end try
	my emit(p & "/" & nm, v)
end fld

-- A property read on its own from the item (the fallback when `properties` fails): an error is recorded.
on one(p, itm, nm)
	try
		set v to my pick(itm, nm)
	on error m number n
		my fail(p & "/" & nm, m, n)
		return
	end try
	my emit(p & "/" & nm, v)
end one

on distinct(lst)
	set r to {}
	repeat with x in lst
		set x to contents of x
		if r does not contain {x} then set end of r to x
	end repeat
	return r
end distinct

-- Per paragraph: text, font, size, color (rich text has nothing else in the dictionary); per item: the distinct fonts and
-- sizes of its words, which shows mixed runs.
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
		if (count of fs) >= j then my emit(q & "/font", item j of fs)
		if (count of ss) >= j then my emit(q & "/size", item j of ss)
		if (count of cs) >= j then my emit(q & "/color", item j of cs)
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

-- A table: one event per cell property over every cell (row-major lists), then row heights and column widths.
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
				else
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

-- Every iWork item of a container (a slide or a group) in the container's order, groups nested (depth + 1).
-- Bulk first (`properties of every iWork item`, one event), else per item `properties`, else property by property.
on probeItems(p, cont, depth)
	set recs to missing value
	set clss to {}
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
				else
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
		if (count of lays) >= i then my emit(p & "/layout", item i of lays)
		repeat with w in {{"default title item", tps}, {"default body item", bps}}
			set nm to item 1 of w
			set lst to item 2 of w
			if (count of lst) >= i then
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

-- The optional last argument: seconds for `with timeout`, else the given default.
on timeoutArg(argv, k, d)
	if (count of argv) >= k then return (item k of argv) as integer
	return d
end timeoutArg

on run argv
	set act to item 1 of argv
	if act is "info" then
		set out to {}
		tell application id "com.apple.Keynote"
			set end of out to "version" & tab & (version as text)
			repeat with d in (every document)
				set end of out to "document" & tab & my esc(id of d) & tab & my esc(name of d)
			end repeat
		end tell
		set AppleScript's text item delimiters to linefeed
		set r to out as text
		set AppleScript's text item delimiters to ""
		return r
	else if act is "open" then
		set inFile to POSIX file (item 2 of argv)
		set t to my timeoutArg(argv, 3, 120)
		set docId to ""
		set cnt to -1
		set sk to {}
		try
			with timeout of t seconds
				tell application id "com.apple.Keynote"
					set d to open inFile
					set docId to id of d
					set cnt to count of slides of d
					set sk to skipped of every slide of d
				end tell
			end timeout
		on error errMsg number errNum
			if errNum is -1712 then return "TIMEOUT" & tab & docId & tab & "open did not answer in " & t & " s (-1712)"
			return "ERROR" & tab & docId & tab & "open failed: " & my esc(errMsg) & " (" & errNum & ")"
		end try
		set r to {}
		repeat with i from 1 to count of sk
			if item i of sk then set end of r to i as text
		end repeat
		set AppleScript's text item delimiters to ","
		set rs to r as text
		set AppleScript's text item delimiters to ""
		return "OPENED" & tab & docId & tab & (cnt as text) & tab & rs
	else if act is "probe" then
		set d to my docRef(item 2 of argv)
		set outPath to item 3 of argv
		set L to {}
		set t to my timeoutArg(argv, 4, 900)
		with timeout of t seconds
			my probeDoc(d)
		end timeout
		my flush()
		return "PROBED"
	else if act is "render" then
		set outFolder to POSIX file (item 3 of argv)
		set d to my docRef(item 2 of argv)
		set t to my timeoutArg(argv, 4, 600)
		with timeout of t seconds
			tell application id "com.apple.Keynote" to export d to outFolder as slide images with properties {image format:PNG, skipped slides:false}
		end timeout
		return "EXPORTED"
	else if act is "resave" then
		set f to POSIX file (item 3 of argv)
		set d to my docRef(item 2 of argv)
		set t to my timeoutArg(argv, 4, 600)
		with timeout of t seconds
			tell application id "com.apple.Keynote" to export d to f as Microsoft PowerPoint
		end timeout
		return "EXPORTED"
	else if act is "close" then
		set docId to item 2 of argv
		set t to my timeoutArg(argv, 3, 60)
		tell application id "com.apple.Keynote"
			if not (exists document id docId) then return "GONE"
			with timeout of t seconds
				close document id docId saving no
			end timeout
			if exists document id docId then return "STILL-OPEN"
		end tell
		return "CLOSED"
	end if
	error "unknown verb " & act
end run
