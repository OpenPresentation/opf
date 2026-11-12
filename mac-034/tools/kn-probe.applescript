-- Read-only probe: per-slide item counts from Keynote's object model, plus a PPTX export copy for the round trip.
-- usage: osascript kn-probe.applescript <in.pptx> <out-dir> <export-pptx yes|no>
on run argv
	set inPath to item 1 of argv
	set outDir to item 2 of argv
	set doExport to item 3 of argv
	set inFile to POSIX file inPath
	set outPptx to POSIX file (outDir & "/keynote-export.pptx")
	set report to ""
	tell application id "com.apple.Keynote"
		set theDoc to open inFile
		delay 3
		set n to count of slides of theDoc
		repeat with i from 1 to n
			set s to slide i of theDoc
			set report to report & "slide " & i & " charts=" & (count of charts of s) & " tables=" & (count of tables of s) & " images=" & (count of images of s) & " shapes=" & (count of shapes of s) & " lines=" & (count of lines of s) & " groups=" & (count of groups of s) & " textItems=" & (count of text items of s) & " skipped=" & (skipped of s) & linefeed
		end repeat
		if doExport is "yes" then
			export theDoc to outPptx as Microsoft PowerPoint
		end if
		close theDoc saving no
	end tell
	return report
end run
