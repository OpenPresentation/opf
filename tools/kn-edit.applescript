-- In-memory edits through Keynote 16.0's dictionary, for kn-edit. Never saves; kn-edit closes the document saving no afterwards.
--   osascript kn-edit.applescript <op> <document id> <slide> [args...]
-- ops:
--   title <slide> <text>                       set the default title item's text (turns the title on if it is off)
--   body-append <slide> <text>                 append text (lines separated by linefeeds) to the default body item (turns the body on)
--   text <slide> <item> <text>                 set the object text of iWork item <item>
--   append <slide> <item> <text>               append to the object text of iWork item <item>
--   rows <slide> <table> <count>               set the row count of table <table> (there is no "add row" command)
--   cell <slide> <table> <cell name> <value>   set a cell's value (cell name like B3)
--   move <slide> <item> <dx> <dy>              move iWork item <item>; prints every line's start/end point before and after
--   slide-numbers <true|false>                 document's slide numbers showing (slide argument ignored, pass 0)
--   read <slide>                               prints the slide's items: class, position, size, text (for checking an edit)
-- Prints what it changed, or "ERROR<TAB>number message".

on joinList(l, d)
	set AppleScript's text item delimiters to d
	set t to l as text
	set AppleScript's text item delimiters to ""
	return t
end joinList

on pts(lst)
	set r to {}
	repeat with p in lst
		set end of r to "(" & (item 1 of p) & "," & (item 2 of p) & ")"
	end repeat
	return my joinList(r, " ")
end pts

on run argv
	set op to item 1 of argv
	set docId to item 2 of argv
	set sn to (item 3 of argv) as integer
	try
		tell application id "com.apple.Keynote"
			set d to document id docId
			if op is "title" then
				set s to slide sn of d
				if not (title showing of s) then set title showing of s to true
				set object text of default title item of s to (item 4 of argv)
				return "title=" & (object text of default title item of s)
			else if op is "body-append" then
				set s to slide sn of d
				if not (body showing of s) then set body showing of s to true
				set t0 to object text of default body item of s
				if t0 is "" then
					set object text of default body item of s to (item 4 of argv)
				else
					set object text of default body item of s to t0 & linefeed & (item 4 of argv)
				end if
				return "body=" & (object text of default body item of s)
			else if op is "text" then
				set itm to iWork item ((item 4 of argv) as integer) of slide sn of d
				set object text of itm to (item 5 of argv)
				return "text=" & (object text of itm)
			else if op is "append" then
				set itm to iWork item ((item 4 of argv) as integer) of slide sn of d
				set object text of itm to (object text of itm) & linefeed & (item 5 of argv)
				return "text=" & (object text of itm)
			else if op is "rows" then
				set tb to table ((item 4 of argv) as integer) of slide sn of d
				set r0 to row count of tb
				set row count of tb to ((item 5 of argv) as integer)
				return "rows " & r0 & " -> " & (row count of tb) & "; height " & (height of tb)
			else if op is "cell" then
				set tb to table ((item 4 of argv) as integer) of slide sn of d
				set c to cell (item 5 of argv) of tb
				set value of c to (item 6 of argv)
				return "cell " & (item 5 of argv) & " = " & (formatted value of c)
			else if op is "move" then
				set s to slide sn of d
				set itm to iWork item ((item 4 of argv) as integer) of s
				set sp0 to start point of every line of s
				set ep0 to end point of every line of s
				set p to position of itm
				set position of itm to {(item 1 of p) + ((item 5 of argv) as integer), (item 2 of p) + ((item 6 of argv) as integer)}
				delay 0.5
				set sp1 to start point of every line of s
				set ep1 to end point of every line of s
				return "moved item from (" & (item 1 of p) & "," & (item 2 of p) & ")" & linefeed & "lines before: start " & my pts(sp0) & " end " & my pts(ep0) & linefeed & "lines after:  start " & my pts(sp1) & " end " & my pts(ep1)
			else if op is "slide-numbers" then
				set slide numbers showing of d to ((item 4 of argv) is "true")
				return "slide numbers showing=" & (slide numbers showing of d)
			else if op is "read" then
				set s to slide sn of d
				set out to {}
				set recs to {}
				try
					set recs to properties of every iWork item of s
				end try
				repeat with i from 1 to count of recs
					set r to item i of recs
					set ln to i & tab & ((class of r) as text) & tab & (item 1 of (position of r)) & "," & (item 2 of (position of r)) & tab & (width of r) & "x" & (height of r)
					try
						set ln to ln & tab & (object text of r)
					end try
					set end of out to ln
				end repeat
				return my joinList(out, linefeed)
			end if
		end tell
	on error m number n
		return "ERROR" & tab & n & " " & m
	end try
	return "ERROR" & tab & "unknown op " & op
end run
