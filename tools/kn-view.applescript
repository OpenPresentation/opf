-- Look at one slide in Keynote's document window and in Play, read-only: open, select the slide, capture the window, play from that
-- slide, capture the main display, stop, close without saving.
-- usage: osascript kn-view.applescript <in.pptx> <slide> <out-dir>   (absolute paths)
on run argv
	set inFile to POSIX file (item 1 of argv)
	set n to (item 2 of argv) as integer
	set outDir to item 3 of argv
	tell application id "com.apple.Keynote"
		activate
		set theDoc to open inFile
		delay 3
		set current slide of theDoc to slide n of theDoc
		delay 2
		set winId to id of front window
	end tell
	do shell script "screencapture -x -o -l " & winId & " " & quoted form of (outDir & "/window-slide-" & n & ".png")
	tell application id "com.apple.Keynote"
		start theDoc from slide n of theDoc
		delay 4
	end tell
	do shell script "screencapture -x -m " & quoted form of (outDir & "/play-slide-" & n & ".png")
	tell application id "com.apple.Keynote"
		stop theDoc
		delay 1
		close theDoc saving no
	end tell
	return "ok"
end run
