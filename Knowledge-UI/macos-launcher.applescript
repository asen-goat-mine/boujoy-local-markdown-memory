use framework "Foundation"
use scripting additions

on run
    try
        -- `path to me` fails in some macOS applet contexts. NSBundle returns
        -- the running app bundle deterministically, including Apple Silicon.
        set appBundlePath to (current application's NSBundle's mainBundle()'s bundlePath()) as text
        set resolvedAppPath to do shell script ("/bin/realpath " & quoted form of appBundlePath)
        set appDirectory to do shell script ("/usr/bin/dirname " & quoted form of resolvedAppPath)
        set launcherPath to appDirectory & "/open-preview.command"
        do shell script ("/bin/test -x " & quoted form of launcherPath)
        do shell script ("/bin/zsh " & quoted form of launcherPath)
    on error errorMessage number errorNumber
        display dialog ("Local Markdown Memory failed to start." & return & return & errorMessage) buttons {"OK"} default button "OK" with icon stop
    end try
end run
