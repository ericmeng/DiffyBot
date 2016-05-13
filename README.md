# DiffyBot
Automated perceptual diff testing bot.

## add it to your package.JSON
```json
"devDependencies": {
  "diffy-bot": "https://github.com/LoyaltyOne/DiffyBot.git#master",
}
```

## Config
```javascript
var config = {
    specDir: pdiffTestRootDir + 'spec/',
    testDir: pdiffTestRootDir + 'test/',
    diffDir: pdiffTestRootDir + 'diff/',
    screenWidth: 1024,
    screenHeight: 768
};
```

## Import Diffy
```javascript
const Diffy = require('diffy-bot');
```

## Creating an instance to record and set the baseline
```javascript
var diffy = new Diffy(config, 'record');
```

## Creating an instance to check regression against the baseline
```javascript
var diffy = new Diffy(config, 'regression');
```

## Re-adjust the screen size
```javascript
//promised call
diffy.standarizeScreenSize();
```

## Use protractor to navigate to some page, then take screenshots of that page
```javascript
//promised call that resolves to true if no regression in the page, false otherwise
diffy.walkThroughPage(testSuiteName, testCaseName);
```
In 'record' mode, screenshots will be saved in specDir/testSuiteName with testCaseName prefix.
In 'regression' mode, screenshots will be compared and any differences are saved in diffDir/testSuiteName with testCaseName prefix.
On success, the promise will be resolved to true, and false otherwise.
Record mode always succeed unless there're other errors.
