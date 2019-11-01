!include x64.nsh
!include nsDialogs.nsh
!include LogicLib.nsh
!include MUI2.nsh
!include WordFunc.nsh

;------------------------
;Page - Installation type:
; - Application and services (recommended for server installations)
; - Application without services (recommended for local stand-alone installations)

;Page declaration
!macro pageInstallationTypeDeclare
  PageEx ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}custom
    PageCallbacks ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}iType.Create_${MUI_UNIQUEID} ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}iType.Leave_${MUI_UNIQUEID}

    Caption " "
  PageExEnd

  !insertmacro pageInstallationTypeFunctions ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}iType.Create_${MUI_UNIQUEID} ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}iType.Leave_${MUI_UNIQUEID}
!macroend

;Page functions
!macro pageInstallationTypeFunctions CREATE LEAVE
; Variables
  Var Dialog
  Var UseServices
  Var DontUseServices
  Var installationTypeUseServices

;  Create dialog
  Function "${CREATE}"
    !insertmacro MUI_HEADER_TEXT "Choose Installation type" "Chose if application should use services"

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
      Abort
    ${EndIf}

    ${NSD_CreateGroupBox} 0% 5u 100% 45u "Installation type"
    Pop $0
      ${NSD_CreateRadioButton} 3% 19u 94% 10u "Application and services (recommended for server installations)"
      Pop $UseServices

      ${NSD_CreateRadioButton} 3% 33u 94% 10u "Application without services (recommended for local stand-alone installations)"
      Pop $DontUseServices

      ; check if we don't already have app installed at this location and configured installation type
      IfFileExists "$INSTDIR\winCfg.cfg" file_found file_not_found
      IfErrors file_not_found
      file_found:
        FileOpen $1 "$INSTDIR\winCfg.cfg" r
        FileRead $1 $2
        FileClose $1
        ${WordFind} $2 "installationTypeUseServices=" "+1" $3
        ${if} $3 = 0
          ;Without services
          ${NSD_Check} $DontUseServices
        ${else}
          ;With services
          ${NSD_Check} $UseServices
        ${endIf}
        goto file_finish
      file_not_found:
        ${NSD_Check} $UseServices
      file_finish:

    nsDialogs::Show
  FunctionEnd

;  Leave dialog
  Function "${LEAVE}"
    ${NSD_GetState} $DontUseServices $0

    ; write settings
    ${if} $0 = 1
      ;Without services
      StrCpy $installationTypeUseServices 0
    ${else}
      ;With services
      StrCpy $installationTypeUseServices 1
    ${endIf}
  FunctionEnd
!macroend

;Init page
!macro customPageInstallationType
  !verbose push
  !verbose ${MUI_VERBOSE}

  !insertmacro MUI_PAGE_INIT
  !insertmacro pageInstallationTypeDeclare

  !verbose pop
!macroend
;End of installation type
;------------------------

;------------------------
;Add custom pages after change directory page
!macro customPageAfterChangeDir
  !insertmacro customPageInstallationType
!macroend
;------------------------

!macro preInit
  ${ifNot} ${isUpdated}
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
  ${endIf}
!macroend

!macro customInstall
  ;Write app config
  FileOpen $0 "$INSTDIR\winCfg.cfg" w
  IfErrors file_error
  FileWrite $0 "installationTypeUseServices=$installationTypeUseServices"
  FileClose $0
  goto file_finish
  file_error:
    MessageBox MB_OK "Error opening app config file"
  file_finish:
!macroend

!macro unregisterFileAssociations
  ;Determine if we use services
  IfFileExists "$INSTDIR\winCfg.cfg" file_found used_services
  IfErrors used_services
  file_found:
    FileOpen $1 "$INSTDIR\winCfg.cfg" r
    FileRead $1 $2
    FileClose $1
    ${WordFind} $2 "installationTypeUseServices=" "+1" $3
    ${if} $3 = 0
      ;Without services
      goto no_services
    ${else}
      ;With services
      goto used_services
    ${endIf}
  used_services:
    ;Remove services
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
  no_services:
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