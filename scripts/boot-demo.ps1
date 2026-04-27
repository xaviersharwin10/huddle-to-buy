Set-Location 'H:\Huddle1\huddle-to-buy'
wsl killall node tsx axl 2>$null; Start-Sleep 2
.\scripts\start-nodes.ps1

Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location 'H:\Huddle1\huddle-to-buy\agent'; `$env:AXL_API='http://127.0.0.1:9032'; `$env:PRIVATE_KEY='0xf01962b99237d8525781736ca31397756cd1345e01e09ba529a86a8353275f0c'; `$env:SELLER_PEER_ID='0d6836e00c80d151a9a6b3157e9d30131bf6611c49e560ee0fdba264679d8238'; `$env:PORT=3004; pnpm exec tsx src/index.ts seller" -WindowStyle Minimized

Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location 'H:\Huddle1\huddle-to-buy\agent'; Get-Content '.env.buyer3' | Where-Object { `$_ -match '^[^#].+=.+' } | ForEach-Object { `$p=`$_ -split '=',2; [System.Environment]::SetEnvironmentVariable(`$p[0].Trim(),`$p[1].Trim(),'Process') }; `$env:PORT=3003; pnpm exec tsx src/index.ts run daemon" -WindowStyle Minimized

Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location 'H:\Huddle1\huddle-to-buy\agent'; Get-Content '.env.buyer2' | Where-Object { `$_ -match '^[^#].+=.+' } | ForEach-Object { `$p=`$_ -split '=',2; [System.Environment]::SetEnvironmentVariable(`$p[0].Trim(),`$p[1].Trim(),'Process') }; `$env:PORT=3002; pnpm exec tsx src/index.ts run daemon" -WindowStyle Minimized

Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location 'H:\Huddle1\huddle-to-buy\agent'; Get-Content '.env.buyer1' | Where-Object { `$_ -match '^[^#].+=.+' } | ForEach-Object { `$p=`$_ -split '=',2; [System.Environment]::SetEnvironmentVariable(`$p[0].Trim(),`$p[1].Trim(),'Process') }; `$env:PORT=3001; pnpm exec tsx src/index.ts run daemon" -WindowStyle Minimized
