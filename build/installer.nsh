!include x64.nsh

!macro preInit
  ${ifNot} ${isUpdated}
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
  ${endIf}
!macroend

!macro customUnInstall
  ClearErrors
  # remove app data on uninstall
  ${GetOptions} $R0 "--updated" $R1
    ${if} ${Errors}
      # remove services
      ${if} ${RunningX64}
        Exec "$INSTDIR\resources\platforms\win\x64\default\nssm\nssm.exe" "stop" "GoDataAPI"
        Exec "$INSTDIR\resources\platforms\win\x64\default\nssm\nssm.exe" "remove" "GoDataAPI" "confirm"
        Exec "$INSTDIR\resources\platforms\win\x64\default\nssm\nssm.exe" "stop" "GoDataStorageEngine"
        Exec "$INSTDIR\resources\platforms\win\x64\default\nssm\nssm.exe" "remove" "GoDataStorageEngine" "confirm"
      ${else}
        Exec "$INSTDIR\resources\platforms\win\x86\default\nssm\nssm.exe" "stop" "GoDataAPI"
        Exec "$INSTDIR\resources\platforms\win\x86\default\nssm\nssm.exe" "remove" "GoDataAPI" "confirm"
        Exec "$INSTDIR\resources\platforms\win\x86\default\nssm\nssm.exe" "stop" "GoDataStorageEngine"
        Exec "$INSTDIR\resources\platforms\win\x86\default\nssm\nssm.exe" "remove" "GoDataStorageEngine" "confirm"
      ${endIf}

      # remove data for all users
      ${if} $installMode == "all"
        RMDir /r "$INSTDIR\..\data"
      ${else}
        RMDir /r "$APPDATA\${APP_FILENAME}"
      ${endIf}
    ${endif}
!macroend