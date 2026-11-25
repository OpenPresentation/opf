on run argv
	set p to POSIX file (item 1 of argv)
	with timeout of 90 seconds
		tell application id "com.apple.Keynote"
			set d to open p
			delay 3
			return (id of d) & "|" & (name of d) & "|" & (count of slides of d)
		end tell
	end timeout
end run
