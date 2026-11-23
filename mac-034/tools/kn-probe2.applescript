-- Read-only probe of an opened PPTX in Keynote: document layouts, and per slide its layout, title (text, paragraphs, font, size),
-- presenter notes length and the fonts of its text items, shapes and table cells. Never saves the document.
-- usage: osascript kn-probe2.applescript <in.pptx>   (absolute path; build POSIX file outside the tell block, or Keynote's sandbox refuses it)
on clean(t)
	set AppleScript's text item delimiters to {return, linefeed, tab}
	set parts to text items of t
	set AppleScript's text item delimiters to " | "
	set r to parts as text
	set AppleScript's text item delimiters to ""
	return r
end clean

on addFont(lst, f)
	if f is missing value then return lst
	if lst does not contain {f} then set end of lst to f
	return lst
end addFont

on joinList(lst)
	set AppleScript's text item delimiters to ","
	set r to lst as text
	set AppleScript's text item delimiters to ""
	return r
end joinList

on run argv
	set inFile to POSIX file (item 1 of argv)
	set out to ""
	tell application id "com.apple.Keynote"
		set theDoc to open inFile
		delay 3
		set layoutNames to name of every slide layout of theDoc
		set out to out & "layouts" & tab & (count of layoutNames) & tab & my clean(my joinList(layoutNames)) & linefeed
		set out to out & "size" & tab & (width of theDoc) & "x" & (height of theDoc) & linefeed
		set n to count of slides of theDoc
		repeat with i from 1 to n
			set s to slide i of theDoc
			set lay to ""
			try
				set lay to name of base layout of s
			end try
			set ts to title showing of s
			set tt to ""
			set tp to 0
			set tf to ""
			set tz to ""
			if ts then
				try
					set ot to object text of default title item of s
					set tt to ot as text
					set tp to count of paragraphs of ot
				end try
				try
					set tf to font of object text of default title item of s
				end try
				try
					set tz to (size of object text of default title item of s) as text
				end try
			end if
			set nl to 0
			try
				set nl to length of (presenter notes of s as text)
			end try
			set fontList to {}
			repeat with obj in (every text item of s)
				try
					set fontList to my addFont(fontList, font of object text of obj)
				end try
			end repeat
			repeat with obj in (every shape of s)
				try
					if (object text of obj as text) is not "" then set fontList to my addFont(fontList, font of object text of obj)
				end try
			end repeat
			repeat with tb in (every table of s)
				try
					repeat with f in (font name of every cell of tb)
						set fontList to my addFont(fontList, f as text)
					end repeat
				end try
			end repeat
			set out to out & "slide" & tab & i & tab & my clean(lay) & tab & ts & tab & tp & tab & tf & tab & tz & tab & nl & tab & my joinList(fontList) & tab & my clean(tt) & linefeed
		end repeat
		close theDoc saving no
	end tell
	return out
end run
