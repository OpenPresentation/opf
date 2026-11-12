on run argv
	set inPath to item 1 of argv
	set outDir to item 2 of argv
	set inFile to POSIX file inPath
	set outFolder to POSIX file (outDir & "/slides")
	tell application id "com.apple.Keynote"
		set docsA to count of documents
		set theDoc to open inFile
		delay 3
		set n to count of slides of theDoc
		set w to width of theDoc
		set h to height of theDoc
		set winId to id of front window
	end tell
	do shell script "screencapture -x -o -l " & winId & " " & quoted form of (outDir & "/_window.png")
	tell application id "com.apple.Keynote"
		export theDoc to outFolder as slide images with properties {image format:PNG, skipped slides:true}
		close theDoc saving no
		set docsB to count of documents
	end tell
	return "slides=" & n & " size=" & w & "x" & h & " docsBefore=" & docsA & " docsAfter=" & docsB
end run
