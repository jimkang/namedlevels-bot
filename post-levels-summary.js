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

var dryRun = false;
if (process.argv.length > 2) {
  dryRun = (process.argv[2].toLowerCase() == '--dry');
}

var twit = new Twit(config.twitter);

function postTweet(text, done) {
  if (dryRun) {
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

var levelnamerDefaults = {
  totalLevels: 20,
  // Comment this line out to run it without the cache.
  memoizeServerPort: 4848,
  config: {
    wordnikAPIKey: config.wordnikAPIKey,
  }
};

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
  var text = group.levelNames.map(formatLevelName).join('\n');
  var tweetText = truncateToTweet({
    text: text,
    urlsToAdd: [
      'http://jimkang.com/namedlevels/#/class/' + group.className
    ]
  });

  postTweet(tweetText, done);
}

function formatLevelName(name, i) {
  return i + ': ' + name;
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
