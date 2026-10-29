param([string]$ParserPath = 'tools/scriptdom/package/lib/net462/Microsoft.SqlServer.TransactSql.ScriptDom.dll')
$ErrorActionPreference='Stop'
Add-Type -Path (Resolve-Path -LiteralPath $ParserPath)
$parser=[Microsoft.SqlServer.TransactSql.ScriptDom.TSql160Parser]::new($true)
$failures=0
foreach($file in (Get-ChildItem -LiteralPath database -Filter '*.sql' | Sort-Object Name)) {
 $reader=[System.IO.StringReader]::new([System.IO.File]::ReadAllText($file.FullName))
 $parseErrors=[System.Collections.Generic.List[Microsoft.SqlServer.TransactSql.ScriptDom.ParseError]]::new()
 $null=$parser.Parse($reader,[ref]$parseErrors)
 $reader.Dispose()
 if($parseErrors.Count) {
  foreach($issue in $parseErrors) { Write-Output ($file.Name+':'+$issue.Line+':'+$issue.Column+' '+$issue.Message);$failures++ }
 } else {Write-Output ('PASS '+$file.Name)}
}
if($failures){exit 1}
Write-Output 'SQL Server 2022 syntax parsing passed. Database execution is still required for semantic validation.'
