<html>
	<head>
		<meta charset="UTF-8" name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Chiriboga</title>
		<link href="images/favicon.ico" rel="icon">
		<link rel="manifest" href="manifest.json">
		<?php
		include 'cardrenderer/webfont.php';
		$dev = true; //set false for release
		if ($dev) {
			echo '<script>var runner={}; var corp={}; var cardSet=[]; var setIdentifiers = [];</script>';
			echo '<script src="sets/midnightsun.js?' . filemtime('sets/midnightsun.js') . '"></script>';
		}
//use PHP to produce the desired css code
//specify either 'P' for portrait or 'L' for landscape
$CS = function ($px, $orientation) {
	if ($orientation == 'P') {
		$vw = 0.125;
		$vh = 0.09;
	} else if ($orientation == 'L') {
		$vw = 0.067;
		$vh = 0.092;
	}
	if ($px < 0) return "max(".$px."px,".($vw*$px)."vw,".($vh*$px)."vh)";
	else return "min(".$px."px,".($vw*$px)."vw,".($vh*$px)."vh)";
};
echo <<<EOD
		<style>		
			//* Styles not specific to landscape or portrait */
			.header a:visited {
				color:white;
			}			
			.header a {
				color:white;
			}			
			.header a:hover {
				text-decoration: none;
			}			
			a {
				text-decoration: none;
				color:lightsteelblue;
				font-weight:bold;
				text-align: center;
			}
			.corp {
				color:rgb(50,140,255);
			}
			.runner {
				color:rgb(250,100,100);
			}
			img.corp {
				border-style: solid;
				border-color: rgb(50,140,255);
				background-color: rgb(50,63,72);
			}
			img.runner {
				border-style: solid;
				border-color: rgb(250,100,100);
				background-color: rgb(50,63,72);
			}
			a:hover {
				color:white;
				text-decoration:underline;
			}
			a:hover > img {
				border-color: white;
			}
			.noselect {
			  -webkit-touch-callout: none; /* iOS Safari */
				-webkit-user-select: none; /* Safari */
				 -khtml-user-select: none; /* Konqueror HTML */
				   -moz-user-select: none; /* Old versions of Firefox */
					-ms-user-select: none; /* Internet Explorer/Edge */
						user-select: none; /* Non-prefixed version, currently
											  supported by Chrome, Edge, Opera and Firefox */
			}
			.nobreak {
				white-space: nowrap;
			}
EOD;
for ($i=0; $i<2; $i++) {		
	if ($i == 0) {
		echo '/* Portrait (tall screen) */';
		$porl = 'P';
	} else {
		echo '/* Landscape (wide screen) */';
		echo '@media only screen and (min-aspect-ratio: 5/4) {';
		$porl = 'L';
	}
echo <<<EOD
			body {
				font-family: "Lucida Console", Monaco, monospace;
				color: white;
				background:#354149;
				background-image: url('images/bg.jpg');
				background-size:cover;
				padding-top:{$CS(100,$porl)};
				text-align:center;
			}
			.header {
				background-color: rgb(62,71,80);
				border-bottom:{$CS(2,$porl)} solid black;
				outline: {$CS(2,$porl)} solid white;
				color:white;
				text-shadow: {$CS(-2,$porl)} {$CS(-2,$porl)} 0 black, {$CS(2,$porl)} {$CS(2,$porl)} 0 black, {$CS(-2,$porl)} {$CS(2,$porl)} 0 black, {$CS(2,$porl)} {$CS(-2,$porl)} 0 black;
				text-align:center;
				position:fixed;
				left:0;
				right:0;
				top:0;
			}
			.footer {
				background-color: rgb(62,71,80);
				outline: {$CS(1,$porl)} solid white;
				color:white;
				text-align:center;
				position:fixed;
				left:0;
				right:0;
				bottom:0;
				padding:{$CS(10,$porl)};
				font-size:{$CS(16,$porl)};
			}
			.tutorial-row {
				margin:auto;
				margin-bottom: {$CS(40,$porl)};
				width:{$CS(620,$porl)};
				font-size:{$CS(16,$porl)};
			}
			.cell {
				width:{$CS(310,$porl)};
				height:{$CS(310,$porl)};
				margin:auto;
			}
			.cell.nosubtitle {
				height:{$CS(280,$porl)};
			}
			a.runner span.subtitle, a.corp span.subtitle {
				font-size: {$CS(14,$porl)};
			}
			a.runner span, a.corp span {
				display:inline-block;
				font-size: {$CS(22,$porl)};
			}
			.header-contents {
				vertical-align:middle;
				font-size: {$CS(32,$porl)};
				margin:{$CS(10,$porl)};
			}
			img.header-contents {
				height:{$CS(67,$porl)};
			}
			img.corp, img.runner {
				width:{$CS(200,$porl)};
				border-radius: {$CS(128,$porl)};
				border-width: {$CS(2,$porl)};
			}
			.tutorial {
				width:{$CS(40,$porl)};
				height:{$CS(40,$porl)};
				border: {$CS(2,$porl)} solid rgba(255,255,255,0.5);
				border-radius: {$CS(20,$porl)};
				display:inline-block;
				line-height:{$CS(40,$porl)};
				color:white;
				font-family: 'PlayBoldNisei';
				font-size:{$CS(18,$porl)};
			}
			.tutorial:hover {
				border: {$CS(2,$porl)} solid white;
				color:white;
				font-weight: bold;
				text-decoration: none;
				cursor:pointer;
			}
			h3 {
				margin-top:{$CS(5,$porl)};
				margin-bottom:{$CS(10,$porl)};
				font-size: {$CS(18,$porl)};
			}
			.ltp-link {
				margin-top:{$CS(10,$porl)};
				font-size: {$CS(16,$porl)};
			}
EOD;
if ($porl == 'P') {
//Portrait-specific
echo <<<EOD
			.row-column {
				display: inline-block;
				width: {$CS(310,$porl)};
				margin:auto;
				margin-bottom: {$CS(60,$porl)};
			}
			.caption {
				margin-top: {$CS(8,$porl)};
				margin-left: {$CS(8,$porl)};
				margin-right: {$CS(8,$porl)};
			}
			.landscape-only {
				display:none;
			}
EOD;
} else {
//Landscape-specific
echo <<<EOD
			.row-column {
				display: flex;
				flex-wrap: nowrap;
				flex-direction: row;
				width: {$CS(1240,$porl)};
				margin:auto;
			}
			a.runner {
				flex: 1;
				margin-bottom: {$CS(40,$porl)};
			}
			a.corp {
				flex: 1;
				margin-bottom: {$CS(60,$porl)};
			}
			.cell.nosubtitle {
				height:{$CS(310,$porl)};
			}
			.landscape-only {
				display:initial;
			}
			.portrait-only {
				display:none;
			}
		}
EOD;
//Do not include adaptive css after this because the landscape section has closed (})
} } ?>
		</style>
	</head>
<?php
	if ($dev) echo '<body onload="document.getElementById(\'dev-info\').innerHTML = \'Development version (cards up to \' + cardSet[cardSet.length-1].title + \')&emsp;&emsp;|&emsp;&emsp;\';">';
	if ($dev) echo '<body onload="document.getElementById(\'dev-info\').innerHTML = \'Development version&emsp;&emsp;|&emsp;&emsp;\';">';
	else echo '<body>';
	?>
		<div class="header"><a href="engine.php?faceoff=true"><img class="header-contents" src="images/chiriboga_icon.png"><span class="header-contents">Chiriboga<span></a></div>
		<div class="tutorial-row">
			<h3>Learn to play</h3>
			<a href="engine.php?p=r&mentor=0" class="tutorial noselect" title="Clicks and Runs">1</a>
			<a href="engine.php?p=r&mentor=1" class="tutorial noselect" title="Credits and Runner Card Types">2</a>
			<a href="engine.php?p=r&mentor=2" class="tutorial noselect" title="Ice and Icebreakers">3</a>
			<a href="engine.php?p=r&mentor=3" class="tutorial noselect" title="Assets, Trash Costs, and Run Events">4</a>
			<a href="engine.php?p=r&mentor=4" class="tutorial noselect" title="Advancing, Scoring, and Damage">5</a>
			<a href="engine.php?p=c&mentor=5" class="tutorial noselect" title="Upgrades, Root, and Trash on Install">6</a><br/>
			<div class="ltp-link">or read <a href="https://nullsignal.games/players/learn-to-play/">Null Signal Games' Learn to Play guide</a></div>
		</div>
		<div class="row-column">
			<div class="cell nosubtitle"><a class="runner" href="engine.php?ap=6&p=r&r=N4IglgJgpgdgLmOBPEAuEB2AbCANCAZyQLigFsBxAQ1IHcqVUBtLXVgRgCZcueBmHgBYeAVlE8AHLk4AGaXM7tpSzq1XSMG6VM46dATmmG+ck7jN9ul8wL63BAXQC+QA&c=N4IglgJgpgdgLmOBPEAuEB2DIA0IDOS+cUAtgOICGJA7pSqgNoDMGOr7AnFzgCwAMfQbwBMfAKwS+ANhl82vNtN45lqpRtXdp3DIL04MARkMmMY84YvNDNjCvuHJGZ+IC6AXyA"><img class="runner" src="images/menu_runner_1.png"><div class="caption"><span>Runner Tutorial Deck</span></div></a></div>
			<div class="cell nosubtitle"><a class="runner" href="engine.php?p=r&r=N4IglgJgpgdgLmOBPEAuEB2AbCANCAZyQLigFsBxAQ1IHcqVUBtLXVgRgCZcueBmHgBYeAVlE8AHLk4AGaXM7tpSzq1XSMG6VM46dATmmG+ck7jN9ul8wL63h3blKnslr6Y8cPBAXQC+QA&c=N4IglgJgpgdgLmOBPEAuEB2DIA0IDOS+cUAtgOICGJA7pSqgNoDMGOr7AnFzgCwAMfQbwBMfAKwS+ANhl82vNtN45lqpRtXdp3DIL04MARkMmMY84YvNDNjCvuHJGZ5PEr3OcbO9e24-wAOVUlpYLCAXQBfIA"><img class="runner" src="images/menu_runner_2.png"><div class="caption"><span>Runner Advanced Deck</span></div></a></div>
			<div class="cell"><a class="runner" href="decklauncher.php?sets=systemgateway&p=r&r=random"><img class="runner" src="images/menu_runner_3_sg.png"><div class="caption"><span>Runner Deckbuilding</span><span class="subtitle">(System Gateway only)</span></div></a></div>
			<div class="cell"><a class="runner" href="decklauncher.php?sets=systemgateway-systemupdate2021&p=r&r=random"><img class="runner" src="images/menu_runner_4_sg_su21.png"><div class="caption"><span>Runner Deckbuilding</span><span class="subtitle">(with System Update 2021)</span></div></a></div>
			<div class="cell"><a class="runner" href="decklauncher.php?p=r&r=random"><img class="runner" src="images/menu_runner_5_ms.png"><div class="caption"><span>Runner Deckbuilding</span><span class="subtitle">(up to Midnight Sun)</span></div></a></div>
		</div><div class="row-column">
			<div class="cell nosubtitle"><a class="corp" href="engine.php?ap=6&p=c&c=N4IglgJgpgdgLmOBPEAuEB2DIA0IDOS+cUAtgOICGJA7pSqgNoDMGOr7AnFzgCwAMfQbwBMfAKwS+ANhl82vNtN45lqpRtXdp3DIL04MARkMmMY84YvNDNjCvuHJGZ+IC6AXyA&r=N4IglgJgpgdgLmOBPEAuEB2AbCANCAZyQLigFsBxAQ1IHcqVUBtLXVgRgCZcueBmHgBYeAVlE8AHLk4AGaXM7tpSzq1XSMG6VM46dATmmG+ck7jN9ul8wL63BAXQC+QA"><img class="corp" src="images/menu_corp_1.png"><div class="caption"><span>Corp Tutorial Deck</span></div></a></div>
			<div class="cell nosubtitle"><a class="corp" href="engine.php?p=c&c=N4IglgJgpgdgLmOBPEAuEB2DIA0IDOS+cUAtgOICGJA7pSqgNoDMGOr7AnFzgCwAMfQbwBMfAKwS+ANhl82vNtN45lqpRtXdp3DIL04MARkMmMY84YvNDNjCvuHJGZ5PEr3OcbO9e24-wAOVUlpYLCAXQBfIA&r=N4IglgJgpgdgLmOBPEAuEB2AbCANCAZyQLigFsBxAQ1IHcqVUBtLXVgRgCZcueBmHgBYeAVlE8AHLk4AGaXM7tpSzq1XSMG6VM46dATmmG+ck7jN9ul8wL63h3blKnslr6Y8cPBAXQC+QA"><img class="corp" src="images/menu_corp_2.png"><div class="caption"><span>Corp Advanced Deck</span></div></a></div>
			<div class="cell"><a class="corp" href="decklauncher.php?sets=systemgateway&p=c&c=random"><img class="corp" src="images/menu_corp_3_sg.png"><div class="caption"><span>Corp Deckbuilding</span><span class="subtitle">(System Gateway only)</span></div></a></div>
			<div class="cell"><a class="corp" href="decklauncher.php?sets=systemgateway-systemupdate2021&p=c&c=random"><img class="corp" src="images/menu_corp_4_sg_su21.png"><div class="caption"><span>Corp Deckbuilding</span><span class="subtitle">(with System Update 2021)</span></div></a></div>
			<div class="cell"><a class="corp" href="decklauncher.php?p=c&r=random"><img class="corp" src="images/menu_corp_5_ms.png"><div class="caption"><span>Corp Deckbuilding</span><span class="subtitle">(up to Midnight Sun)</span></div></a></div>
		</div>
		<div class="footer">
			<span id="dev-info"></span><span class="nobreak">Source code <a href="https://github.com/bobtheuberfish/chiriboga">available on GitHub</a></span> <span class="landscape-only">&nbsp;| &nbsp;</span><span class="portrait-only"><br></span><span class="nobreak">Hardware Acceleration is required to use this site</span>
		</div>
	</body>
</html>