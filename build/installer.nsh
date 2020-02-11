; Includes
!include x64.nsh
!include nsDialogs.nsh
!include LogicLib.nsh
!include MUI2.nsh
!include WordFunc.nsh

; Plugins
!addplugindir /x86-unicode "${__FILEDIR__}\win\plugins\x86-unicode"
!addplugindir /x86-ansi "${__FILEDIR__}\win\plugins\x86-ansi"
!addplugindir /amd64-unicode "${__FILEDIR__}\win\plugins\amd64-unicode"

;------------------------
;Page - Configure App:
; - Application and services (recommended for server installations)
; - Application without services (recommended for local stand-alone installations)
; - Rewrite api config file
; - Enable / Disable Cors

;Page declaration
!macro pageConfigureAppDeclare
  PageEx ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}custom
    PageCallbacks ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}iCApp.Create_${MUI_UNIQUEID} ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}iCApp.Leave_${MUI_UNIQUEID}

    Caption " "
  PageExEnd

  !insertmacro pageConfigureAppFunctions ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}iCApp.Create_${MUI_UNIQUEID} ${MUI_PAGE_UNINSTALLER_FUNCPREFIX}iCApp.Leave_${MUI_UNIQUEID}
!macroend

;Page functions
!macro pageConfigureAppFunctions CREATE LEAVE
; Variables
  Var Dialog
  Var UseServices
  Var DontUseServices
  Var installationTypeUseServices
  Var AllowRewrite
  Var EnableConfigRewrite
  Var DontAllowRewrite
  Var ConfigProtocol
  Var ConfigProtocolValue
  Var ConfigHost
  Var ConfigHostValue
  Var ConfigPort
  Var ConfigPortValue
  Var ConfigEnableCors
  Var ConfigEnableCorsValue

;  Create dialog
  Function "${CREATE}"
    !insertmacro MUI_HEADER_TEXT "GoData application" "Configure application"

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
      Abort
    ${EndIf}

    ; START OF Installation type - with or without services
    ${NSD_CreateGroupBox} 0 0 100% 36u "Installation type"
    Pop $0
    ${NSD_AddStyle} $0 ${WS_GROUP}
      ${NSD_CreateRadioButton} 3% 10u 94% 10u "Application and services (recommended for server installations)"
      Pop $UseServices

      ${NSD_CreateRadioButton} 3% 22u 94% 10u "Application without services (recommended for local stand-alone installations)"
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
    ; END OF Installation type - with or without services

    ; START OF Rewrite api settings - enable / disable rewrite
    ${NSD_CreateGroupBox} 0 38u 100% 80u "Rewrite api config file"
    Pop $1
    ${NSD_AddStyle} $1 ${WS_GROUP}
      ${NSD_CreateRadioButton} 3% 48u 94% 10u "Allow config rewrite ( system will try to determine domain and other settings )"
      Pop $AllowRewrite
      ${NSD_OnClick} $AllowRewrite ShowHideConfigData

      ${NSD_CreateRadioButton} 3% 60u 94% 10u "Disable config rewrite ( you will have to configure the application )"
      Pop $DontAllowRewrite
      ${NSD_OnClick} $DontAllowRewrite ShowHideConfigData

      ; START OF - No rewrite config inputs
      ; Protocol
      ${NSD_CreateLabel} 3% 74u 12% 12u "Protocol"
      Pop $2
	    ${NSD_CreateDropList} 17% 74u 80% 12u ""
	    Pop $ConfigProtocol
	    ${NSD_CB_AddString} $ConfigProtocol "http"
	    ${NSD_CB_AddString} $ConfigProtocol "https"
	    ${NSD_CB_SelectString} $ConfigProtocol "http"

      ; Host
      ${NSD_CreateLabel} 3% 88u 12% 12u "Host"
      Pop $3
	    ${NSD_CreateText} 17% 88u 80% 12u "localhost"
	    Pop $ConfigHost

      ; Port
      ${NSD_CreateLabel} 3% 101u 12% 12u "Port"
      Pop $4
	    ${NSD_CreateNumber} 17% 101u 80% 12u "8000"
	    Pop $ConfigPort
      ; END OF - No rewrite config inputs
    ; END OF Rewrite api settings - enable / disable rewrite

    ; START OF Enable / Disable cors
    ${NSD_CreateCheckbox} 0 123u 100% 10u "Enable Cross-Origin Resource Sharing"
    Pop $ConfigEnableCors
    ; END OF Enable / Disable cors

    ; START OF Load settings from api config file
    ; check if we don't already have app installed at this location - to retrieve the current settings
    IfFileExists "$INSTDIR\resources\go-data\build\server\config.json" file_found2 file_not_found2
    IfErrors file_not_found2
    file_found2:
      ; read JSON api config file
      nsJSON::Set /file "$INSTDIR\resources\go-data\build\server\config.json"
      ; determine if api config is rewritable
      StrCpy $EnableConfigRewrite ""
      nsJSON::Get enableConfigRewrite
      Pop $EnableConfigRewrite
      ${if} $EnableConfigRewrite == "false"
        ; not rewritable
        ${NSD_Check} $DontAllowRewrite
      ${else}
        ${NSD_Check} $AllowRewrite
      ${endIf}

      ; determine if we have protocol, url and port
      ; Protocol
      StrCpy $ConfigProtocolValue ""
      nsJSON::Get public protocol
      Pop $ConfigProtocolValue
      ${if} $ConfigProtocolValue != ""
        ${NSD_CB_SelectString} $ConfigProtocol "$ConfigProtocolValue"
      ${endIf}

      ; Host
      StrCpy $ConfigHostValue ""
      nsJSON::Get public host
      Pop $ConfigHostValue
      ${if} $ConfigHostValue != ""
        ${NSD_SetText} $ConfigHost $ConfigHostValue
      ${endIf}

      ; Port
      StrCpy $ConfigPortValue ""
      nsJSON::Get public port
      Pop $ConfigPortValue
      ${if} $ConfigPortValue != ""
        ${NSD_SetText} $ConfigPort $ConfigPortValue
      ${endIf}

      ; CORS is enabled ?
      StrCpy $ConfigEnableCorsValue ""
      nsJSON::Get cors enabled
      Pop $ConfigEnableCorsValue
      ${if} $ConfigEnableCorsValue == "true"
        ${NSD_Check} $ConfigEnableCors
      ${else}
        ${NSD_Uncheck} $ConfigEnableCors
      ${endIf}

      ; finished
      goto file_finish2
    file_not_found2:
      ; default value
      ${NSD_Check} $AllowRewrite
      ${NSD_Uncheck} $ConfigEnableCors
    file_finish2:

    ; disable / enable components
    Call ShowHideConfigData
    ; END OF Load settings from api config file

    nsDialogs::Show
  FunctionEnd

  ; Handle Config show / hide settings
  Function ShowHideConfigData
    ${NSD_GetState} $DontAllowRewrite $0
    ${if} $0 = 1
	    EnableWindow $ConfigProtocol 1
	    EnableWindow $ConfigHost 1
	    EnableWindow $ConfigPort 1
    ${else}
	    EnableWindow $ConfigProtocol 0
	    EnableWindow $ConfigHost 0
	    EnableWindow $ConfigPort 0
    ${endIf}
  FunctionEnd

;  Leave dialog
  Function "${LEAVE}"
    ; START OF - determine if we should use services or not
    ${NSD_GetState} $DontUseServices $0

    ; write settings
    ${if} $0 = 1
      ;Without services
      StrCpy $installationTypeUseServices 0
    ${else}
      ;With services
      StrCpy $installationTypeUseServices 1
    ${endIf}
    ; END OF - determine if we should use services or not

    ; START OF - determine if we should allow api config file rewrite or not
    ${NSD_GetState} $DontAllowRewrite $0
    ${if} $0 = 1
      ; Disable rewrite
      StrCpy $enableConfigRewrite false
      ${NSD_GetText} $ConfigProtocol $ConfigProtocolValue
      ${NSD_GetText} $ConfigHost $ConfigHostValue
      ${NSD_GetText} $ConfigPort $ConfigPortValue
    ${else}
      StrCpy $enableConfigRewrite true
    ${endIf}
    ; END OF - determine if we should allow api config file rewrite or not

    ; START OF - CORS enabled / disabled
    ${NSD_GetState} $ConfigEnableCors $0
    ${if} $0 = 1
      StrCpy $ConfigEnableCorsValue true
    ${else}
      StrCpy $ConfigEnableCorsValue false
    ${endIf}
    ; END OF - CORS enabled / disabled
  FunctionEnd
!macroend

;Init page
!macro customPageConfigureApp
  !verbose push
  !verbose ${MUI_VERBOSE}

  !insertmacro MUI_PAGE_INIT
  !insertmacro pageConfigureAppDeclare

  !verbose pop
!macroend
;End of installation type
;------------------------

;------------------------
;Add custom pages after change directory page
!macro customPageAfterChangeDir
  !insertmacro customPageConfigureApp
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

  ; START OF - write to api config file & enable / disable CORS
  IfFileExists "$INSTDIR\resources\go-data\build\server\config.json" file_found3 file_finish3
  IfErrors file_finish3
  file_found3:
    ; read JSON api config file
    nsJSON::Set /file "$INSTDIR\resources\go-data\build\server\config.json"

    ; determine what changed
    ${if} $enableConfigRewrite == true
      nsJSON::Set enableConfigRewrite /value true
    ${else}
      nsJSON::Set enableConfigRewrite /value false
      nsJSON::Set public protocol /value '"$ConfigProtocolValue"'
      nsJSON::Set public host /value '"$ConfigHostValue"'
      nsJSON::Set public port /value '"$ConfigPortValue"'
    ${endIf}

    ; write enable / disable CORS
    ${if} $ConfigEnableCorsValue == true
      nsJSON::Set cors enabled /value true
    ${else}
      nsJSON::Set cors enabled /value false
    ${endIf}

    ; write - flush
    nsJSON::Serialize /format /file "$INSTDIR\resources\go-data\build\server\config.json"
  file_finish3:
  ; END OF - write to api config file & enable / disable CORS
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