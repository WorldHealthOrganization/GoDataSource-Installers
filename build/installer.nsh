!macro preInit
  ${ifNot} ${isUpdated}
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Go.Data\bin"
  ${endIf}
!macroend