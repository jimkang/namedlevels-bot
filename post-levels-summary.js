var config = require('./config');
var callBackOnNextTick = require('conform-async').callBackOnNextTick;
var Twit = require('twit');
var createWordnok = require('wordnok').createWordnok;
var async = require('async');
var levelnamer = require('levelnamer');
var canonicalizer = require('canonicalizer');
var queue = require('queue-async');
var _  = require('lodash');
var countUniqueLevels = require('./count-unique-levels');
var truncateToTweet = require('tweet-truncate');
var probable = require('probable');

var cmdOpts = require('nomnom')
  .option('dryRun', {
    abbr: 'dry',
    flag: true,
    help: 'Do not actually post to Twitter.'
  })
  .option('skipCache', {
    abbr: 'skip-cache',
    flag: true,
    help: 'Skip connecting to the levelnames cache over RPC.'
  })
  .parse();

var levelnamerDefaults = {
  totalLevels: 20,
  config: {
    wordnikAPIKey: config.wordnikAPIKey
  }
};

if (!cmdOpts.skipCache) {
  levelnamerDefaults.memoizeServerPort = 4848;
}

var twit = new Twit(config.twitter);

function postTweet(text, done) {
  if (cmdOpts.dryRun) {
    console.log('Would have tweeted:', text);
    callBackOnNextTick(done);
  }
  else {
    twit.post(
      'statuses/update',
      {
        status: text
      },
      function tweetDone(error, data, response) {
        if (error) {
          console.log(error);
          console.log('data:', data);
        }
        else {
          console.log('Posted to Twitter:', text);
        }
        done(error);
      }
    );
  }
}

var wordnok = createWordnok({
  apiKey: config.wordnikAPIKey
});

// wordnok.getRandomWords(null, checkW)

function getCandidates(done) {
  wordnok.getRandomWords(
    {
      customParams: {
        includePartOfSpeech: '',
        limit: 4
      }
    },
    done
  );
}

function getLevelsForCandidates(candidates, done) {
  var singularCandidates = candidates.map(singularize);

  var q = queue(2);

  singularCandidates.forEach(scheduleLevelNaming);

  function scheduleLevelNaming(candidate) {
    var opts = {
      word: candidate
    };
    q.defer(levelnamer.getNamedLevels, _.defaults(opts, levelnamerDefaults));
  }

  q.awaitAll(groupNamesAndCandidates);

  function groupNamesAndCandidates(error, nameSets) {
    if (error) {
      done(error);
    }
    else {
      var groups = nameSets.map(groupNamesToCandidate);
      done(error, groups);
    }
  }

  function groupNamesToCandidate(nameSet, i) {
    return {
      className: singularCandidates[i],
      levelNames: nameSet
    };
  }
}

function singularize(word) {
  return canonicalizer.getSingularAndPluralForms(word)[0];
}

function pluralize(word) {
  return canonicalizer.getSingularAndPluralForms(word)[1];
}

function pickBestGroup(candidateGroups, done) {
  // console.log(candidateGroups.map(countUniqueLevels));

  var bestGroup = candidateGroups.slice(1).reduce(
    pickGroupWithMostUniqueNames, candidateGroups[0]
  );

  callBackOnNextTick(done, null, bestGroup);
}

function pickGroupWithMostUniqueNames(groupA, groupB) {
  if (countUniqueLevels(groupA) > countUniqueLevels(groupB)) {
    return groupA;
  }
  else {
    return groupB;
  }
}

function postGroup(group, done) {
  var text = summarizeLevelNames(group);
  var tweetText = truncateToTweet({
    text: text,
    urlsToAdd: [
      'http://jimkang.com/namedlevels/#/class/' + group.className
    ]
  });

  postTweet(tweetText, done);
}

function summarizeLevelNames(classProfile) {
  var summary = pluralize(classProfile.className).toUpperCase();
  summary += ' TABLE I.\n\n';

  var sampleStart = probable.roll(10);
  var sampleEnd = sampleStart + 4 + probable.roll(4);
  if (sampleEnd >= classProfile.levelNames.length) {
    sampleEnd = classProfile.levelNames.length - 1;
  }

  var sampleNames = classProfile.levelNames.slice(sampleStart, sampleEnd);

  var levelText = sampleNames.map(formatLevelName).join('\n');

  return summary + levelText;

  function formatLevelName(name, i) {
    return 'Level ' + (sampleStart + i + 1) + ': ' + name;
  }
}


async.waterfall(
  [
    getCandidates,
    getLevelsForCandidates,
    pickBestGroup,
    postGroup
  ],
  // TODO: Get rid of this when multilevel is cleaned up.
  process.exit
);
