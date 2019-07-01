!include x64.nsh

!macro preInit
  ${ifNot} ${isUpdated}
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
  ${endIf}
!macroend

!macro unregisterFileAssociations
  # remove services
  ${if} ${RunningX64}
    ExecWait '"$INSTDIR\resources\platforms\win\x64\default\nssm\nssm.exe" stop GoDataAPI' $1
    DetailPrint "GoDataAPI remove returned $1"
    Sleep 1000

    ExecWait '"$INSTDIR\resources\platforms\win\x64\default\nssm\nssm.exe" remove GoDataAPI confirm' $2
    DetailPrint "GoDataAPI remove returned $2"
    Sleep 1000

    ExecWait '"$INSTDIR\resources\platforms\win\x64\default\nssm\nssm.exe" stop GoDataStorageEngine' $3
    DetailPrint "GoDataStorageEngine stop returned $3"
    Sleep 1000

    ExecWait '"$INSTDIR\resources\platforms\win\x64\default\nssm\nssm.exe" remove GoDataStorageEngine confirm' $4
    DetailPrint "GoDataStorageEngine remove returned $4"
    Sleep 1000

  ${else}
    ExecWait '"$INSTDIR\resources\platforms\win\x86\default\nssm\nssm.exe" stop GoDataAPI'
    Sleep 1000
    ExecWait '"$INSTDIR\resources\platforms\win\x86\default\nssm\nssm.exe" remove GoDataAPI confirm'
    Sleep 1000
    ExecWait '"$INSTDIR\resources\platforms\win\x86\default\nssm\nssm.exe" stop GoDataStorageEngine'
    Sleep 1000
    ExecWait '"$INSTDIR\resources\platforms\win\x86\default\nssm\nssm.exe" remove GoDataStorageEngine confirm'
    Sleep 1000
  ${endIf}
!macroend

!macro customUnInstall
  ClearErrors
  # remove app data on uninstall
  ${GetOptions} $R0 "--updated" $R1
    ${if} ${Errors}
      # remove data for all users
      ${if} $installMode == "all"
        RMDir /r "$INSTDIR\..\data"
      ${else}
        RMDir /r "$APPDATA\${APP_FILENAME}"
      ${endIf}
      MessageBox MB_YESNO|MB_ICONQUESTION "Go.Data requires a system reboot to finish the uninstall. Do you want to reboot now?" IDNO +2
      Reboot
    ${endif}
!macroend