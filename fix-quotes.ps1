$content = Get-Content C:\projects\pepper\web\components\inventory\ingredient-dialog.tsx -Raw
$content = $content.Replace('"Ajustar stock"', '"Ajustar stock"')
Set-Content C:\projects\pepper\web\components\inventory\ingredient-dialog.tsx $content