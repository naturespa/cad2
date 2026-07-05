param([switch]$SelfTest)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

function V($x, $y, $z) {
    [PSCustomObject]@{ X = [double]$x; Y = [double]$y; Z = [double]$z }
}

function J([int[]]$codes) {
    -join ($codes | ForEach-Object { [char]$_ })
}

$script:Triangles = New-Object System.Collections.Generic.List[object]
$script:Yaw = -0.55
$script:Pitch = 0.45
$script:LastMouse = $null
$script:ModelName = "cad2-model"
$script:ModelInfo = "Ready"

$KW = @{
    globe = @((J @(0x5730,0x7403,0x5100)), (J @(0x30B0,0x30ED,0x30FC,0x30D6)))
    stand = @((J @(0x30B9,0x30BF,0x30F3,0x30C9)))
    phone = @((J @(0x30B9,0x30DE,0x30DB)), (J @(0x30B9,0x30DE,0x30FC,0x30C8,0x30D5,0x30A9,0x30F3)), (J @(0x643A,0x5E2F)))
    chair = @((J @(0x6905,0x5B50)), (J @(0x30A4,0x30B9)), (J @(0x3044,0x3059)), (J @(0x30C1,0x30A7,0x30A2)))
    table = @((J @(0x673A)), (J @(0x30C6,0x30FC,0x30D6,0x30EB)), (J @(0x30C7,0x30B9,0x30AF)))
    house = @((J @(0x5BB6)), (J @(0x5C0F,0x5C4B)), (J @(0x5EFA,0x7269)))
    car = @((J @(0x8ECA)), (J @(0x81EA,0x52D5,0x8ECA)))
    plane = @((J @(0x98DB,0x884C,0x6A5F)), (J @(0x822A,0x7A7A,0x6A5F)))
    boat = @((J @(0x8239)), (J @(0x30DC,0x30FC,0x30C8)), (J @(0x821F)))
    animal = @((J @(0x732B)), (J @(0x72AC)), (J @(0x52D5,0x7269)))
    cylinder = @((J @(0x5186,0x67F1)), (J @(0x4E38,0x68D2)))
    sphere = @((J @(0x7403)), (J @(0x30DC,0x30FC,0x30EB)), (J @(0x4E38)))
    box = @((J @(0x7BB1)), (J @(0x56DB,0x89D2)), (J @(0x30D6,0x30ED,0x30C3,0x30AF)))
    tray = @((J @(0x5C0F,0x7269,0x5165,0x308C)), (J @(0x30B1,0x30FC,0x30B9)))
    hook = @((J @(0x30D5,0x30C3,0x30AF)), (J @(0x639B,0x3051)))
    ring = @((J @(0x30EA,0x30F3,0x30B0)), (J @(0x8F2A)))
}

function HasAny($text, [string[]]$words) {
    foreach ($word in $words) {
        if ($text.Contains($word)) { return $true }
    }
    return $false
}

function AddTri($a, $b, $c, $color) {
    $script:Triangles.Add([PSCustomObject]@{ A = $a; B = $b; C = $c; Color = $color }) | Out-Null
}

function AddQuad($a, $b, $c, $d, $color) {
    AddTri $a $b $c $color
    AddTri $a $c $d $color
}

function AddBox($cx, $cy, $cz, $w, $h, $d, $color) {
    $x = $w / 2; $y = $h / 2; $z = $d / 2
    $p000 = V ($cx-$x) ($cy-$y) ($cz-$z)
    $p100 = V ($cx+$x) ($cy-$y) ($cz-$z)
    $p110 = V ($cx+$x) ($cy+$y) ($cz-$z)
    $p010 = V ($cx-$x) ($cy+$y) ($cz-$z)
    $p001 = V ($cx-$x) ($cy-$y) ($cz+$z)
    $p101 = V ($cx+$x) ($cy-$y) ($cz+$z)
    $p111 = V ($cx+$x) ($cy+$y) ($cz+$z)
    $p011 = V ($cx-$x) ($cy+$y) ($cz+$z)
    AddQuad $p000 $p100 $p110 $p010 $color
    AddQuad $p101 $p001 $p011 $p111 $color
    AddQuad $p001 $p000 $p010 $p011 $color
    AddQuad $p100 $p101 $p111 $p110 $color
    AddQuad $p010 $p110 $p111 $p011 $color
    AddQuad $p001 $p101 $p100 $p000 $color
}

function AddCylinder($cx, $cy, $cz, $r, $h, $segments, $axis, $color) {
    for ($i = 0; $i -lt $segments; $i++) {
        $a0 = 2 * [Math]::PI * $i / $segments
        $a1 = 2 * [Math]::PI * ($i + 1) / $segments
        $x0 = [Math]::Cos($a0) * $r; $z0 = [Math]::Sin($a0) * $r
        $x1 = [Math]::Cos($a1) * $r; $z1 = [Math]::Sin($a1) * $r
        if ($axis -eq "X") {
            $a = V ($cx-$h/2) ($cy+$x0) ($cz+$z0)
            $b = V ($cx+$h/2) ($cy+$x0) ($cz+$z0)
            $c = V ($cx+$h/2) ($cy+$x1) ($cz+$z1)
            $d = V ($cx-$h/2) ($cy+$x1) ($cz+$z1)
            AddQuad $a $b $c $d $color
            AddTri (V ($cx-$h/2) $cy $cz) $d $a $color
            AddTri (V ($cx+$h/2) $cy $cz) $b $c $color
        } elseif ($axis -eq "Z") {
            $a = V ($cx+$x0) ($cy+$z0) ($cz-$h/2)
            $b = V ($cx+$x0) ($cy+$z0) ($cz+$h/2)
            $c = V ($cx+$x1) ($cy+$z1) ($cz+$h/2)
            $d = V ($cx+$x1) ($cy+$z1) ($cz-$h/2)
            AddQuad $a $b $c $d $color
            AddTri (V $cx $cy ($cz-$h/2)) $d $a $color
            AddTri (V $cx $cy ($cz+$h/2)) $b $c $color
        } else {
            $a = V ($cx+$x0) ($cy-$h/2) ($cz+$z0)
            $b = V ($cx+$x0) ($cy+$h/2) ($cz+$z0)
            $c = V ($cx+$x1) ($cy+$h/2) ($cz+$z1)
            $d = V ($cx+$x1) ($cy-$h/2) ($cz+$z1)
            AddQuad $a $b $c $d $color
            AddTri (V $cx ($cy-$h/2) $cz) $d $a $color
            AddTri (V $cx ($cy+$h/2) $cz) $b $c $color
        }
    }
}

function AddCone($cx, $cy, $cz, $r, $h, $axis, $color) {
    $segments = 40
    for ($i = 0; $i -lt $segments; $i++) {
        $a0 = 2 * [Math]::PI * $i / $segments
        $a1 = 2 * [Math]::PI * ($i + 1) / $segments
        $x0 = [Math]::Cos($a0) * $r; $z0 = [Math]::Sin($a0) * $r
        $x1 = [Math]::Cos($a1) * $r; $z1 = [Math]::Sin($a1) * $r
        if ($axis -eq "X") {
            $tip = V ($cx+$h/2) $cy $cz
            $b0 = V ($cx-$h/2) ($cy+$x0) ($cz+$z0)
            $b1 = V ($cx-$h/2) ($cy+$x1) ($cz+$z1)
            AddTri $tip $b0 $b1 $color
            AddTri (V ($cx-$h/2) $cy $cz) $b1 $b0 $color
        } else {
            $tip = V $cx ($cy+$h/2) $cz
            $b0 = V ($cx+$x0) ($cy-$h/2) ($cz+$z0)
            $b1 = V ($cx+$x1) ($cy-$h/2) ($cz+$z1)
            AddTri $tip $b0 $b1 $color
            AddTri (V $cx ($cy-$h/2) $cz) $b1 $b0 $color
        }
    }
}

function AddSphere($cx, $cy, $cz, $r, $color) {
    $lat = 16; $lon = 32
    for ($i = 0; $i -lt $lat; $i++) {
        $t0 = [Math]::PI * $i / $lat
        $t1 = [Math]::PI * ($i + 1) / $lat
        for ($j = 0; $j -lt $lon; $j++) {
            $p0 = 2 * [Math]::PI * $j / $lon
            $p1 = 2 * [Math]::PI * ($j + 1) / $lon
            $a = V ($cx+$r*[Math]::Sin($t0)*[Math]::Cos($p0)) ($cy+$r*[Math]::Cos($t0)) ($cz+$r*[Math]::Sin($t0)*[Math]::Sin($p0))
            $b = V ($cx+$r*[Math]::Sin($t1)*[Math]::Cos($p0)) ($cy+$r*[Math]::Cos($t1)) ($cz+$r*[Math]::Sin($t1)*[Math]::Sin($p0))
            $c = V ($cx+$r*[Math]::Sin($t1)*[Math]::Cos($p1)) ($cy+$r*[Math]::Cos($t1)) ($cz+$r*[Math]::Sin($t1)*[Math]::Sin($p1))
            $d = V ($cx+$r*[Math]::Sin($t0)*[Math]::Cos($p1)) ($cy+$r*[Math]::Cos($t0)) ($cz+$r*[Math]::Sin($t0)*[Math]::Sin($p1))
            AddTri $a $b $c $color
            AddTri $a $c $d $color
        }
    }
}

function AddTorusY($cx, $cy, $cz, $major, $minor, $color) {
    $segA = 44; $segB = 10
    for ($i = 0; $i -lt $segA; $i++) {
        $a0 = 2 * [Math]::PI * $i / $segA
        $a1 = 2 * [Math]::PI * ($i + 1) / $segA
        for ($j = 0; $j -lt $segB; $j++) {
            $b0 = 2 * [Math]::PI * $j / $segB
            $b1 = 2 * [Math]::PI * ($j + 1) / $segB
            function TP($a, $b) {
                V ($cx + ($major + $minor * [Math]::Cos($b)) * [Math]::Cos($a)) `
                  ($cy + $minor * [Math]::Sin($b)) `
                  ($cz + ($major + $minor * [Math]::Cos($b)) * [Math]::Sin($a))
            }
            $p00 = TP $a0 $b0; $p10 = TP $a1 $b0; $p11 = TP $a1 $b1; $p01 = TP $a0 $b1
            AddQuad $p00 $p10 $p11 $p01 $color
        }
    }
}

function GetDimensions($text) {
    $numbers = New-Object System.Collections.Generic.List[double]
    foreach ($m in [regex]::Matches($text, '(\d+(?:\.\d+)?)\s*(cm|mm)?', 'IgnoreCase')) {
        $v = [double]$m.Groups[1].Value
        if ($m.Groups[2].Value.ToLower() -eq "cm") { $v *= 10 }
        $numbers.Add($v) | Out-Null
    }
    $w = if ($numbers.Count -gt 0) { $numbers[0] } else { 80 }
    $d = if ($numbers.Count -gt 1) { $numbers[1] } else { 50 }
    $h = if ($numbers.Count -gt 2) { $numbers[2] } else { 45 }
    [PSCustomObject]@{ W = [double]$w; D = [double]$d; H = [double]$h }
}

function ClearModel() {
    $script:Triangles.Clear()
}

function BuildGlobe($dim) {
    $baseH = [Math]::Max(5, $dim.H * 0.12)
    $r = [Math]::Min([Math]::Min($dim.W, $dim.D), $dim.H * 0.72) * 0.32
    $globeY = $baseH + $r + [Math]::Max(8, $dim.H * 0.12)
    AddBox 0 ($baseH/2) 0 ($dim.W*0.82) $baseH ($dim.D*0.72) ([System.Drawing.Color]::FromArgb(55, 68, 84))
    AddCylinder 0 (($globeY+$baseH)/2) 0 ([Math]::Max(2, $r*0.08)) ($globeY-$baseH) 24 "Y" ([System.Drawing.Color]::FromArgb(55, 68, 84))
    AddSphere 0 $globeY 0 $r ([System.Drawing.Color]::FromArgb(39, 166, 154))
    AddTorusY 0 $globeY 0 ($r*1.08) ([Math]::Max(1.4, $r*0.045)) ([System.Drawing.Color]::FromArgb(240, 178, 61))
    AddCylinder 0 ($globeY-$r*0.58) 0 ([Math]::Max(1.8, $r*0.07)) ($r*1.15) 20 "Y" ([System.Drawing.Color]::FromArgb(240, 178, 61))
    $script:ModelName = "cad2-globe-stand"
    $script:ModelInfo = "Globe stand / $($script:Triangles.Count) triangles"
}

function BuildChair($dim) {
    $seatY = [Math]::Max(18, $dim.H * 0.42)
    $seatH = [Math]::Max(5, $dim.H * 0.08)
    $legR = [Math]::Max(2.5, [Math]::Min($dim.W, $dim.D) * 0.045)
    foreach ($x in @(-1,1)) { foreach ($z in @(-1,1)) { AddCylinder ($x*($dim.W/2-$legR*2)) ($seatY/2) ($z*($dim.D/2-$legR*2)) $legR $seatY 18 "Y" ([System.Drawing.Color]::FromArgb(55,68,84)) } }
    AddBox 0 ($seatY+$seatH/2) 0 $dim.W $seatH $dim.D ([System.Drawing.Color]::FromArgb(39,166,154))
    AddBox 0 ($seatY+($dim.H-$seatY)/2) ($dim.D/2) $dim.W ($dim.H-$seatY) ([Math]::Max(5,$dim.D*0.12)) ([System.Drawing.Color]::FromArgb(240,178,61))
    $script:ModelName = "cad2-chair"
    $script:ModelInfo = "Chair / $($script:Triangles.Count) triangles"
}

function BuildTable($dim) {
    $topH = [Math]::Max(5, $dim.H * 0.1)
    $legH = $dim.H - $topH
    $legR = [Math]::Max(3, [Math]::Min($dim.W, $dim.D) * 0.045)
    foreach ($x in @(-1,1)) { foreach ($z in @(-1,1)) { AddCylinder ($x*($dim.W/2-$legR*2)) ($legH/2) ($z*($dim.D/2-$legR*2)) $legR $legH 18 "Y" ([System.Drawing.Color]::FromArgb(55,68,84)) } }
    AddBox 0 ($legH+$topH/2) 0 $dim.W $topH $dim.D ([System.Drawing.Color]::FromArgb(39,166,154))
    $script:ModelName = "cad2-table"
    $script:ModelInfo = "Table / $($script:Triangles.Count) triangles"
}

function BuildHouse($dim) {
    $bodyH = $dim.H * 0.66
    AddBox 0 ($bodyH/2) 0 $dim.W $bodyH $dim.D ([System.Drawing.Color]::FromArgb(39,166,154))
    AddCone 0 ($bodyH + ($dim.H-$bodyH)/2) 0 ([Math]::Max($dim.W,$dim.D)*0.72) ($dim.H-$bodyH) "Y" ([System.Drawing.Color]::FromArgb(240,178,61))
    AddBox 0 ($bodyH*0.2) (-$dim.D/2-1.5) ($dim.W*0.22) ($bodyH*0.4) 3 ([System.Drawing.Color]::FromArgb(55,68,84))
    $script:ModelName = "cad2-house"
    $script:ModelInfo = "House / $($script:Triangles.Count) triangles"
}

function BuildVehicle($dim) {
    $wr = [Math]::Max(5, [Math]::Min($dim.W,$dim.D)*0.1)
    AddBox 0 ($wr+$dim.H*0.2) 0 $dim.W ($dim.H*0.4) $dim.D ([System.Drawing.Color]::FromArgb(39,166,154))
    AddBox ($dim.W*0.05) ($wr+$dim.H*0.55) 0 ($dim.W*0.48) ($dim.H*0.3) ($dim.D*0.7) ([System.Drawing.Color]::FromArgb(240,178,61))
    foreach ($x in @(-0.32,0.32)) { foreach ($z in @(-1,1)) { AddCylinder ($dim.W*$x) $wr ($z*($dim.D/2+1)) $wr 5 24 "Z" ([System.Drawing.Color]::FromArgb(55,68,84)) } }
    $script:ModelName = "cad2-vehicle"
    $script:ModelInfo = "Vehicle / $($script:Triangles.Count) triangles"
}

function BuildFromPrompt($text) {
    ClearModel
    $dim = GetDimensions $text
    if (HasAny $text $KW.globe) { BuildGlobe $dim }
    elseif ((HasAny $text $KW.phone) -and (HasAny $text $KW.stand)) {
        AddBox 0 4 0 $dim.W 8 $dim.D ([System.Drawing.Color]::FromArgb(55,68,84))
        AddBox 0 ($dim.H/2+6) 12 $dim.W $dim.H 7 ([System.Drawing.Color]::FromArgb(39,166,154))
        AddBox 0 14 (-$dim.D/2+10) ($dim.W*0.7) 8 12 ([System.Drawing.Color]::FromArgb(240,178,61))
        $script:ModelName = "cad2-phone-stand"; $script:ModelInfo = "Phone stand / $($script:Triangles.Count) triangles"
    }
    elseif (HasAny $text $KW.chair) { BuildChair $dim }
    elseif (HasAny $text $KW.table) { BuildTable $dim }
    elseif (HasAny $text $KW.house) { BuildHouse $dim }
    elseif (HasAny $text $KW.car) { BuildVehicle $dim }
    elseif (HasAny $text $KW.plane) {
        AddCylinder 0 ($dim.H*0.45) 0 ($dim.H*0.14) $dim.W 28 "X" ([System.Drawing.Color]::FromArgb(39,166,154))
        AddBox 0 ($dim.H*0.45) 0 ($dim.W*0.42) ([Math]::Max(3,$dim.H*0.06)) $dim.D ([System.Drawing.Color]::FromArgb(240,178,61))
        AddBox (-$dim.W*0.42) ($dim.H*0.62) 0 ($dim.W*0.2) ([Math]::Max(3,$dim.H*0.06)) ($dim.D*0.45) ([System.Drawing.Color]::FromArgb(240,178,61))
        AddCone ($dim.W*0.56) ($dim.H*0.45) 0 ($dim.H*0.17) ($dim.W*0.2) "X" ([System.Drawing.Color]::FromArgb(39,166,154))
        $script:ModelName = "cad2-airplane"; $script:ModelInfo = "Airplane / $($script:Triangles.Count) triangles"
    }
    elseif (HasAny $text $KW.boat) {
        AddBox 0 ($dim.H*0.25) 0 $dim.W ($dim.H*0.35) $dim.D ([System.Drawing.Color]::FromArgb(39,166,154))
        AddBox 0 ($dim.H*0.55) 0 ($dim.W*0.5) ($dim.H*0.25) ($dim.D*0.5) ([System.Drawing.Color]::FromArgb(240,178,61))
        $script:ModelName = "cad2-boat"; $script:ModelInfo = "Boat / $($script:Triangles.Count) triangles"
    }
    elseif (HasAny $text $KW.animal) {
        AddSphere 0 ($dim.H*0.46) 0 ([Math]::Min($dim.W,$dim.D)*0.26) ([System.Drawing.Color]::FromArgb(39,166,154))
        AddSphere ($dim.W*0.32) ($dim.H*0.58) 0 ([Math]::Min($dim.W,$dim.D)*0.17) ([System.Drawing.Color]::FromArgb(240,178,61))
        $legR = [Math]::Max(2.5, [Math]::Min($dim.W,$dim.D)*0.045)
        foreach ($x in @(-0.22,0.22)) { foreach ($z in @(-0.18,0.18)) { AddCylinder ($dim.W*$x) ($dim.H*0.17) ($dim.D*$z) $legR ($dim.H*0.34) 16 "Y" ([System.Drawing.Color]::FromArgb(55,68,84)) } }
        $script:ModelName = "cad2-animal"; $script:ModelInfo = "Animal / $($script:Triangles.Count) triangles"
    }
    elseif (HasAny $text $KW.cylinder) {
        AddCylinder 0 ($dim.H/2) 0 ([Math]::Min($dim.W,$dim.D)/2) $dim.H 48 "Y" ([System.Drawing.Color]::FromArgb(39,166,154))
        $script:ModelName = "cad2-cylinder"; $script:ModelInfo = "Cylinder / $($script:Triangles.Count) triangles"
    }
    elseif (HasAny $text $KW.sphere) {
        AddSphere 0 ([Math]::Min($dim.W,$dim.D,$dim.H)/2) 0 ([Math]::Min($dim.W,$dim.D,$dim.H)/2) ([System.Drawing.Color]::FromArgb(39,166,154))
        $script:ModelName = "cad2-sphere"; $script:ModelInfo = "Sphere / $($script:Triangles.Count) triangles"
    }
    else {
        AddBox 0 ($dim.H/2) 0 $dim.W $dim.H $dim.D ([System.Drawing.Color]::FromArgb(39,166,154))
        $script:ModelName = "cad2-basic-box"; $script:ModelInfo = "Basic box / $($script:Triangles.Count) triangles"
    }
}

function RotatePoint($p) {
    $cy = [Math]::Cos($script:Yaw); $sy = [Math]::Sin($script:Yaw)
    $cp = [Math]::Cos($script:Pitch); $sp = [Math]::Sin($script:Pitch)
    $x1 = $p.X * $cy + $p.Z * $sy
    $z1 = -$p.X * $sy + $p.Z * $cy
    $y1 = $p.Y * $cp - $z1 * $sp
    $z2 = $p.Y * $sp + $z1 * $cp
    [PSCustomObject]@{ X = $x1; Y = $y1; Z = $z2 }
}

function Bounds() {
    $all = @()
    foreach ($t in $script:Triangles) { $all += $t.A; $all += $t.B; $all += $t.C }
    if ($all.Count -eq 0) { return [PSCustomObject]@{ MinX=-50; MaxX=50; MinY=0; MaxY=80; MinZ=-50; MaxZ=50 } }
    [PSCustomObject]@{
        MinX = ($all | Measure-Object X -Minimum).Minimum
        MaxX = ($all | Measure-Object X -Maximum).Maximum
        MinY = ($all | Measure-Object Y -Minimum).Minimum
        MaxY = ($all | Measure-Object Y -Maximum).Maximum
        MinZ = ($all | Measure-Object Z -Minimum).Minimum
        MaxZ = ($all | Measure-Object Z -Maximum).Maximum
    }
}

function Project($p, $panel, $scale, $centerX, $centerY) {
    $rp = RotatePoint $p
    [PSCustomObject]@{
        X = [int]($centerX + $rp.X * $scale)
        Y = [int]($centerY - $rp.Y * $scale)
        Z = $rp.Z
    }
}

function WriteStl($path) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("solid $script:ModelName")
    foreach ($t in $script:Triangles) {
        $u = V ($t.B.X-$t.A.X) ($t.B.Y-$t.A.Y) ($t.B.Z-$t.A.Z)
        $v = V ($t.C.X-$t.A.X) ($t.C.Y-$t.A.Y) ($t.C.Z-$t.A.Z)
        $nx = $u.Y*$v.Z - $u.Z*$v.Y
        $ny = $u.Z*$v.X - $u.X*$v.Z
        $nz = $u.X*$v.Y - $u.Y*$v.X
        $len = [Math]::Sqrt($nx*$nx + $ny*$ny + $nz*$nz)
        if ($len -gt 0) { $nx/=$len; $ny/=$len; $nz/=$len }
        [void]$sb.AppendLine("facet normal $nx $ny $nz")
        [void]$sb.AppendLine("  outer loop")
        foreach ($p in @($t.A,$t.B,$t.C)) { [void]$sb.AppendLine("    vertex $($p.X) $($p.Y) $($p.Z)") }
        [void]$sb.AppendLine("  endloop")
        [void]$sb.AppendLine("endfacet")
    }
    [void]$sb.AppendLine("endsolid $script:ModelName")
    [System.IO.File]::WriteAllText($path, $sb.ToString(), [System.Text.Encoding]::ASCII)
}

if ($SelfTest) {
    $testPrompt = "80mm 50mm 45mm " + (J @(0x5730,0x7403,0x5100)) + " " + (J @(0x30B9,0x30BF,0x30F3,0x30C9))
    BuildFromPrompt $testPrompt
    if ($script:Triangles.Count -le 0) { throw "No triangles generated." }
    $testPath = Join-Path $env:TEMP "cad2-offline-selftest.stl"
    WriteStl $testPath
    $item = Get-Item $testPath
    if ($item.Length -le 100) { throw "STL output is too small." }
    Write-Output "SelfTest OK: $script:ModelName, triangles=$($script:Triangles.Count), stl=$($item.Length) bytes"
    exit 0
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "cad2 Offline CAD"
$form.Width = 1120
$form.Height = 760
$form.StartPosition = "CenterScreen"

$left = New-Object System.Windows.Forms.Panel
$left.Dock = "Left"
$left.Width = 360
$left.Padding = New-Object System.Windows.Forms.Padding(14)
$form.Controls.Add($left)

$title = New-Object System.Windows.Forms.Label
$title.Text = "cad2 Offline CAD"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$title.Height = 42
$title.Dock = "Top"
$left.Controls.Add($title)

$exGlobe = "80mm 50mm 45mm " + (J @(0x5730,0x7403,0x5100)) + " " + (J @(0x30B9,0x30BF,0x30F3,0x30C9))
$exChair = "70mm 60mm 80mm " + (J @(0x6905,0x5B50))
$exCar = "100mm 60mm 70mm " + (J @(0x8ECA))
$exPlane = "120mm 90mm 35mm " + (J @(0x98DB,0x884C,0x6A5F))
$exCylinder = "40mm 70mm " + (J @(0x5186,0x67F1))

$prompt = New-Object System.Windows.Forms.TextBox
$prompt.Multiline = $true
$prompt.Height = 130
$prompt.Dock = "Top"
$prompt.Font = New-Object System.Drawing.Font("Meiryo UI", 11)
$prompt.Text = $exGlobe
$left.Controls.Add($prompt)

$buttons = New-Object System.Windows.Forms.FlowLayoutPanel
$buttons.Dock = "Top"
$buttons.Height = 96
$buttons.Padding = New-Object System.Windows.Forms.Padding(0, 12, 0, 0)
$left.Controls.Add($buttons)

$generate = New-Object System.Windows.Forms.Button
$generate.Text = "Generate"
$generate.Width = 100
$generate.Height = 36
$buttons.Controls.Add($generate)

$save = New-Object System.Windows.Forms.Button
$save.Text = "Save STL"
$save.Width = 100
$save.Height = 36
$buttons.Controls.Add($save)

$examples = New-Object System.Windows.Forms.ComboBox
$examples.DropDownStyle = "DropDownList"
$examples.Width = 300
[void]$examples.Items.Add($exGlobe)
[void]$examples.Items.Add($exChair)
[void]$examples.Items.Add($exCar)
[void]$examples.Items.Add($exPlane)
[void]$examples.Items.Add($exCylinder)
$examples.SelectedIndex = 0
$buttons.Controls.Add($examples)

$info = New-Object System.Windows.Forms.Label
$info.Dock = "Top"
$info.Height = 80
$info.Font = New-Object System.Drawing.Font("Meiryo UI", 10)
$info.Text = "Offline. No browser. No internet."
$left.Controls.Add($info)

$preview = New-Object System.Windows.Forms.Panel
$preview.Dock = "Fill"
$preview.BackColor = [System.Drawing.Color]::FromArgb(243,247,250)
$form.Controls.Add($preview)

$examples.Add_SelectedIndexChanged({ $prompt.Text = [string]$examples.SelectedItem })

$generate.Add_Click({
    BuildFromPrompt $prompt.Text
    $info.Text = $script:ModelInfo + "`r`nDrag preview to rotate. Save STL when ready."
    $preview.Invalidate()
})

$save.Add_Click({
    if ($script:Triangles.Count -eq 0) { BuildFromPrompt $prompt.Text }
    $dialog = New-Object System.Windows.Forms.SaveFileDialog
    $dialog.Filter = "STL files (*.stl)|*.stl"
    $dialog.FileName = "$script:ModelName.stl"
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        WriteStl $dialog.FileName
        $info.Text = "Saved: $($dialog.FileName)"
    }
})

$preview.Add_MouseDown({ param($s,$e) $script:LastMouse = $e.Location })
$preview.Add_MouseMove({
    param($s,$e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left -and $script:LastMouse -ne $null) {
        $script:Yaw += ($e.X - $script:LastMouse.X) * 0.01
        $script:Pitch += ($e.Y - $script:LastMouse.Y) * 0.01
        $script:Pitch = [Math]::Max(-1.35, [Math]::Min(1.35, $script:Pitch))
        $script:LastMouse = $e.Location
        $preview.Invalidate()
    }
})
$preview.Add_MouseUp({ $script:LastMouse = $null })

$preview.Add_Paint({
    param($s, $e)
    $g = $e.Graphics
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear($preview.BackColor)
    $b = Bounds
    $modelW = [Math]::Max(1, $b.MaxX - $b.MinX)
    $modelH = [Math]::Max(1, $b.MaxY - $b.MinY)
    $scale = [Math]::Min(($preview.Width-80)/$modelW, ($preview.Height-80)/$modelH)
    $scale = [Math]::Min($scale, 7)
    $cx = $preview.Width / 2
    $cy = $preview.Height / 2 + 40

    $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(210,220,230), 1)
    for ($i=-5; $i -le 5; $i++) {
        $p1 = Project (V ($i*20) 0 -100) $preview $scale $cx $cy
        $p2 = Project (V ($i*20) 0 100) $preview $scale $cx $cy
        $g.DrawLine($gridPen, $p1.X, $p1.Y, $p2.X, $p2.Y)
        $p3 = Project (V -100 0 ($i*20)) $preview $scale $cx $cy
        $p4 = Project (V 100 0 ($i*20)) $preview $scale $cx $cy
        $g.DrawLine($gridPen, $p3.X, $p3.Y, $p4.X, $p4.Y)
    }

    $draw = @()
    foreach ($t in $script:Triangles) {
        $a = Project $t.A $preview $scale $cx $cy
        $b2 = Project $t.B $preview $scale $cx $cy
        $c = Project $t.C $preview $scale $cx $cy
        $draw += [PSCustomObject]@{ P = @($a,$b2,$c); Z = ($a.Z+$b2.Z+$c.Z)/3; Color = $t.Color }
    }
    foreach ($d in ($draw | Sort-Object Z)) {
        $pts = [System.Drawing.Point[]]@(
            (New-Object System.Drawing.Point($d.P[0].X, $d.P[0].Y)),
            (New-Object System.Drawing.Point($d.P[1].X, $d.P[1].Y)),
            (New-Object System.Drawing.Point($d.P[2].X, $d.P[2].Y))
        )
        $brush = New-Object System.Drawing.SolidBrush($d.Color)
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(55,70,80), 1)
        $g.FillPolygon($brush, $pts)
        $g.DrawPolygon($pen, $pts)
        $brush.Dispose(); $pen.Dispose()
    }
})

BuildFromPrompt $prompt.Text
$info.Text = $script:ModelInfo + "`r`nDrag preview to rotate. Save STL when ready."
[void]$form.ShowDialog()
