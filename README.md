# DiffyBot
Automated perceptual diff testing bot.
Run the bot in record mode to setup a baseline of screenshots.
Later run the bot in regression mode to test against the baseline
while saving all visual differences into the diffDir.

## Add Diffy to your package.json
```json
"devDependencies": {
  "diffy-bot": "https://github.com/LoyaltyOne/DiffyBot.git#0.1.0",
}
```

## Import Diffy
```javascript
const Diffy = require('diffy-bot');
```

## Config
```javascript
var config = {
    delay: 2000,   //wait time for screen to settle down (due to animation and scrolling)
    specDir: pdiffTestRootDir + 'spec/',    //baseline screenshots
    testDir: pdiffTestRootDir + 'test/',    //screenshots of current test
    diffDir: pdiffTestRootDir + 'diff/',    //visual differences (if any)
    screenWidth: 1024,
    screenHeight: 768
};
```

## Either create an instance that runs in record mode
```javascript
var diffy = new Diffy(config, 'record');
```

## Or create an instance for regression test against the baseline
```javascript
var diffy = new Diffy(config, 'regression');
```

## Before doing anything, re-adjust and standardize the screen size (just do it once)
## as protractor can only set browser size which contains other components
## (border, titlebar, widgets, etc) and the screen size would be different
## on different platforms.
```javascript
//promised call
diffy.standarizeScreenSize();
```

## Use protractor to navigate to some page
```javascript
//promised call
browser.get('/#/some/page');
```

## Then take screenshots of that page from top to bottom, record or compare them.
```javascript
//promised call that resolves to true if no regression in the page, false otherwise
diffy.walkThroughPage(testSuiteName, testCaseName);
```
In 'record' mode, screenshots will be saved in specDir/testSuiteName/testCaseName_[1,2,3... from top to botom].png
In 'regression' mode, screenshots will be compared and any differences are saved in diffDir under the same structure.
If all tests passes, the promise will be resolved to true, and false otherwise.
Record mode always succeed unless there're other errors.

## Or you may ask diffy to take a single screenshot of the current screen, record or compare it.
```javascript
//promised call that resolves to true if no regression in current screen, false otherwise
diffy.recordScreenshotOrCheckRegression(testSuiteName, testCaseName);
```
In 'record' mode, screenshots will be saved in specDir/testSuiteName/testCaseName.png
In 'regression' mode, screenshots will be compared and any differences are saved in diffDir under the same structure.
If test passes, the promise will be resolved to true, and false otherwise.
Record mode always succeed unless there're other errors.
