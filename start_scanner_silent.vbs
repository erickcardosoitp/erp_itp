Dim dir
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c """ & dir & "\start_scanner.bat""", 0, False
