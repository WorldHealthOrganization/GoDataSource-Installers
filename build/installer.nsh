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
  Var ConfigAdminEmail
  Var ConfigAdminEmailValue
  Var sNext

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
      ${NSD_OnClick} $UseServices InstallationTypeChanged

      ${NSD_CreateRadioButton} 3% 22u 94% 10u "Application without services (recommended for local stand-alone installations)"
      Pop $DontUseServices
      ${NSD_OnClick} $DontUseServices InstallationTypeChanged

      ; check if we don't already have app installed at this location and configured installation type
      ClearErrors
      IfFileExists "$INSTDIR\winCfg.cfg" file_found file_not_found
      IfErrors file_not_found
      file_found:
        FileOpen $1 "$INSTDIR\winCfg.cfg" r
        FileRead $1 $2
        FileClose $1
        ${WordFind} $2 "installationTypeUseServices=" "+1" $3
        ${if} $3 == '0'
          ;Without services
          ${NSD_Check} $DontUseServices
        ${else}
          ${if} $3 == '1'
            ;With services
            ${NSD_Check} $UseServices
          ${endIf}
        ${endIf}
        goto file_finish
      file_not_found:
        ; Don't choose anything to force user to choose
      file_finish:
    ; END OF Installation type - with or without services

    ; START OF Rewrite api settings - enable / disable rewrite
    ${NSD_CreateGroupBox} 0 38u 100% 52u "Rewrite api config file"
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
      ${NSD_CreateLabel} 3% 75u 10% 12u "Protocol"
      Pop $2
	    ${NSD_CreateDropList} 13% 73u 11% 12u ""
	    Pop $ConfigProtocol
	    ${NSD_CB_AddString} $ConfigProtocol "http"
	    ${NSD_CB_AddString} $ConfigProtocol "https"
	    ${NSD_CB_SelectString} $ConfigProtocol "http"

      ; Host
      ${NSD_CreateLabel} 25% 75u 5% 12u "Host"
      Pop $3
	    ${NSD_CreateText} 31% 73u 50% 12u "localhost"
	    Pop $ConfigHost

      ; Port
      ${NSD_CreateLabel} 82% 75u 5% 12u "Port"
      Pop $4
	    ${NSD_CreateNumber} 87% 73u 10% 12u "8000"
	    Pop $ConfigPort
      ; END OF - No rewrite config inputs
    ; END OF Rewrite api settings - enable / disable rewrite

    ; START OF Enable / Disable cors
    ${NSD_CreateCheckbox} 0 95u 100% 10u "Enable Cross-Origin Resource Sharing"
    Pop $ConfigEnableCors
    ; END OF Enable / Disable cors

    ; START OF Admin account email
    ${NSD_CreateLabel} 0 110u 13% 12u "Admin email"
    Pop $5
      ${NSD_CreateText} 14% 108u 85% 12u "admin@who.int"
      Pop $ConfigAdminEmail
      ${NSD_OnChange} $ConfigAdminEmail AdminEmailChanged
    ; END OF Admin account email

    ; START OF Load settings from api config file
    ; check if we don't already have app installed at this location - to retrieve the current API settings
    ClearErrors
    IfFileExists "$INSTDIR\resources\go-data\build\server\config.json" file_found2 file_not_found2
    IfErrors file_not_found2
    file_found2:
      ; clone file so we can use it to keep previous settings
      CopyFiles "$INSTDIR\resources\go-data\build\server\config.json" "$INSTDIR\..\config.json.backup"

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

      ; Admin Email
      StrCpy $ConfigAdminEmailValue ""
      nsJSON::Get adminEmail
      Pop $ConfigAdminEmailValue
      ${if} $ConfigAdminEmailValue != ""
        ${NSD_SetText} $ConfigAdminEmail $ConfigAdminEmailValue
      ${endIf}

      ; finished
      goto file_finish2
    file_not_found2:
      ; default value
      ${NSD_Check} $AllowRewrite
      ${NSD_Uncheck} $ConfigEnableCors
    file_finish2:

    ; check if we don't already have app installed at this location - to retrieve the current datasource settings - e.g.  db, SMTP
    ClearErrors
    IfFileExists "$INSTDIR\resources\go-data\build\server\datasources.json" file_datasource_found file_datasource_not_found
    IfErrors file_datasource_not_found
    file_datasource_found:
      ; clone file so we can use it to keep previous settings
      CopyFiles "$INSTDIR\resources\go-data\build\server\datasources.json" "$INSTDIR\..\datasources.json.backup"
    file_datasource_not_found:
    ; END OF datasource.json backup

    ; disable / enable components
    Call ShowHideConfigData
    ; END OF Load settings from api config file

    ; disable next / install button until everything is valid
    GetDlgItem $sNext $HWNDPARENT 1
    Call EnableDisableNextButton

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

  ; Enable / Disable next / install button
  Function EnableDisableNextButton
    ; START OF Installation type - with or without services
    StrCpy $0 0
    ${NSD_GetState} $DontUseServices $1
    ${NSD_GetState} $UseServices $2
    ${if} $1 = 1
      ${OrIf} $2 = 1
        StrCpy $0 1
    ${EndIf}
    ; END OF Installation type - with or without services

    ; START OF Admin Email
    StrCpy $3 0
    ${NSD_GetText} $ConfigAdminEmail $4
    ${if} $4 != ""
      StrCpy $3 1
    ${endIf}
    ; END OF Admin Email

    ; enable / disable next button
    ${if} $0 = 1
      ${AndIf} $3 = 1
        EnableWindow $sNext 1
    ${else}
      EnableWindow $sNext 0
    ${endIf}

  FunctionEnd

  ; Installation Type Checked
  Function InstallationTypeChanged
    Call EnableDisableNextButton
  FunctionEnd

  ; Admin Email Changed
  Function AdminEmailChanged
    Call EnableDisableNextButton
  FunctionEnd

  ; Leave dialog
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
      StrCpy $EnableConfigRewrite false
      ${NSD_GetText} $ConfigProtocol $ConfigProtocolValue
      ${NSD_GetText} $ConfigHost $ConfigHostValue
      ${NSD_GetText} $ConfigPort $ConfigPortValue
    ${else}
      StrCpy $EnableConfigRewrite true
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

    ; START OF - Admin email
    ${NSD_GetText} $ConfigAdminEmail $ConfigAdminEmailValue
    ; END OF - Admin email

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
  ; Make sure we install app with admin privileges
  ${ifNot} ${Silent}
    UserInfo::GetAccountType
    pop $0
    ${if} $0 != "admin" ; Require admin rights on NT4+
      ${ifNot} ${isUpdated}
        MessageBox mb_iconstop "Administrator rights are required to install 'Go.Data' application. Right click on the installer 'Go.Data-Setup.exe' and choose 'Run as administrator'."
      ${else}
        MessageBox mb_iconstop "Administrator rights are required to perform update. Right click on the shortcut icon of 'Go.Data' and choose 'Run as administrator'."
      ${endIf}
      SetErrorLevel 740 ;ERROR_ELEVATION_REQUIRED
      Quit
    ${endIf}
  ${endIf}

  ; Set default install location
  ${ifNot} ${isUpdated}
    ; Force services to stop once more
    ; - needed to handle older version, starting with upgrades from 40.0 to newer versions this isn't really required
    ExecWait 'sc stop GoDataAPI' $1
    ExecWait 'sc delete GoDataAPI' $2
    ExecWait 'sc stop GoDataStorageEngine' $1
    ExecWait 'sc delete GoDataStorageEngine' $2

    ; set default location
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
  ${endIf}
!macroend

!macro customInstall
  ;Install VC++ redistributable files necessary for MongoDB 5
  ExecWait '"$INSTDIR\resources\platforms\win\x64\default\extras\vcredist_x64.exe" /passive /norestart'

  ;Write app config
  ClearErrors
  FileOpen $0 "$INSTDIR\winCfg.cfg" w
  IfErrors file_error
  FileWrite $0 "installationTypeUseServices=$installationTypeUseServices"
  FileClose $0
  goto file_finish
  file_error:
    MessageBox MB_OK "Error opening app config file => code: $0"
  file_finish:

  ; START OF - write to api config file & enable / disable CORS
  ClearErrors
  IfFileExists "$INSTDIR\resources\go-data\build\server\config.json" file_found3 file_finish3
  IfErrors file_finish3
  file_found3:
    ; backup new file and copy back old one
    ; new properties from new file will be merged once app is started ( by windows application )
    ClearErrors
    IfFileExists "$INSTDIR\..\config.json.backup" file_old_config_found file_old_config_not_found
    IfErrors file_old_config_not_found
    file_old_config_found:
      CopyFiles "$INSTDIR\resources\go-data\build\server\config.json" "$INSTDIR\..\config.json.backup_new"
      CopyFiles "$INSTDIR\..\config.json.backup" "$INSTDIR\resources\go-data\build\server\config.json"
      Delete "$INSTDIR\..\config.json.backup"
    file_old_config_not_found:

    ; read JSON api config file
    nsJSON::Set /file "$INSTDIR\resources\go-data\build\server\config.json"

    ; determine what changed
    ${if} $EnableConfigRewrite == true
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

    ; write admin email
    nsJSON::Set adminEmail /value '"$ConfigAdminEmailValue"'

    ; write - flush
    nsJSON::Serialize /format /file "$INSTDIR\resources\go-data\build\server\config.json"
  file_finish3:
  ; END OF - write to api config file & enable / disable CORS

  ; DATASOURCE.JSON
  ; backup new file and copy back old one
  ; new properties from new file will be merged once app is started ( by windows application )
  ClearErrors
  IfFileExists "$INSTDIR\resources\go-data\build\server\datasources.json" file_datasource_found2 file_datasource_not_found2
  IfErrors file_datasource_not_found2
  file_datasource_found2:
    ClearErrors
    IfFileExists "$INSTDIR\..\datasources.json.backup" file_old_datasource_found file_old_datasource_not_found
    IfErrors file_old_datasource_not_found
    file_old_datasource_found:
      CopyFiles "$INSTDIR\resources\go-data\build\server\datasources.json" "$INSTDIR\..\datasources.json.backup_new"
      CopyFiles "$INSTDIR\..\datasources.json.backup" "$INSTDIR\resources\go-data\build\server\datasources.json"
      Delete "$INSTDIR\..\datasources.json.backup"
    file_old_datasource_not_found:
  file_datasource_not_found2:
  ; END OF datasource.json backup
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
    ${if} $3 == '0'
      ;Without services
      goto no_services
    ${else}
      ${if} $3 == '1'
        ;With services
        goto used_services
      ${endIf}

      ;No info...take a guess
      goto used_services
    ${endIf}
  used_services:
    ; Force services to stop once more
    ExecWait 'sc stop GoDataAPI' $1
    ExecWait 'sc delete GoDataAPI' $2
    ExecWait 'sc stop GoDataStorageEngine' $1
    ExecWait 'sc delete GoDataStorageEngine' $2
  no_services:
!macroend

; Custom remove files, so we don't delete specific directories that we need to keep
!macro customRemoveFiles
  ; default - old way: RMDir /r /REBOOTOK $INSTDIR
  Var /GLOBAL DirToClean
  Var /GLOBAL Step ; install / resources / go-data-build / go-data-build-server

  # remove app data on uninstall
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--updated" $R1
  ${if} ${Errors}
    ; this is not an update, it is a full uninstall
    RMDir /r /REBOOTOK $INSTDIR
    Goto Finish
  ${endif}

  ; new way, delete only what should be deleted
  ; remove files & directories from first level that aren't needed
  ClearErrors
  StrCpy $DirToClean $INSTDIR
  StrCpy $Step "install"
  Main:
    ClearErrors
    FindFirst $R0 $R1 "$DirToClean\*.*"
    IfErrors Exit

    Top:
      StrCmp $R1 "." Next
      StrCmp $R1 ".." Next
      IfFileExists "$DirToClean\$R1\*.*" Directory DeleteFile

      ; Handle directories
      Directory:
        ; ignore directories
        StrCmp $Step "install" Dirs1 Dirs1Finish
        Dirs1:
          StrCmp $R1 "resources" Next
          Goto DirsFinish

        Dirs1Finish:
        StrCmp $Step "resources" Dirs2 Dirs2Finish
        Dirs2:
          StrCmp $R1 "go-data" Next
          Goto DirsFinish

        Dirs2Finish:
        StrCmp $Step "go-data-build" Dirs3 Dirs3Finish
        Dirs3:
          StrCmp $R1 "backups" Next
          StrCmp $R1 "server" Next
          Goto DirsFinish
        Dirs3Finish:

        StrCmp $Step "go-data-build-server" Dirs4 DirsFinish
        Dirs4:
          StrCmp $R1 "storage" Next

        ; not an ignore directory, so we need to delete it
        DirsFinish:
          RMDir /r /REBOOTOK "$DirToClean\$R1"
          Goto Next

      DeleteFile:
        Delete "$DirToClean\$R1"

      Next:
        ClearErrors
        FindNext $R0 $R1
        IfErrors Exit
      Goto Top

    Exit:
    FindClose $R0

    ; cleanup steps
    ; Resources
    StrCmp $Step "install" Step1Job Step2
      Step1Job:
        StrCpy $DirToClean "$DirToClean\resources"
        StrCpy $Step "resources"
        Goto Main

    ; go-data - jump over go-data directory, go directly into build directory, otherwise we need to make sure we don't delete that one too
    Step2:
      StrCmp $Step "resources" Step2Job Step3
        Step2Job:
          StrCpy $DirToClean "$DirToClean\go-data\build"
          StrCpy $Step "go-data-build"
          Goto Main

    ; go-data storage
    Step3:
      StrCmp $Step "go-data-build" Step3Job Finish
        Step3Job:
          StrCpy $DirToClean "$DirToClean\server"
          StrCpy $Step "go-data-build-server"
          Goto Main

    ; Finished
    Finish:
!macroend

!macro customUnInit
  ; Make sure we install app with admin privileges
  UserInfo::GetAccountType
  pop $0
  ${if} $0 != "admin" ; Require admin rights on NT4+
    MessageBox mb_iconstop "Administrator rights are required to perform uninstall. Right click on 'Uninstall Go.Data.exe' (from 'Go.Data' folder) and choose 'Run as administrator'."
    SetErrorLevel 740 ;ERROR_ELEVATION_REQUIRED
    Quit
  ${endif}
!macroend

!macro customUnInstall
  ClearErrors
  # remove app data on uninstall
  ${GetParameters} $R0
  ${GetOptions} $R0 "--updated" $R1
  # having errors means that this isn't an update
  ${if} ${Errors}
    # remove data for all users
    ${if} $installMode == "all"
      RMDir /r "$INSTDIR\..\data"
    ${else}
      RMDir /r "$APPDATA\${APP_FILENAME}"
    ${endIf}
  ${endif}
!macroend
