function countUniqueLevels(classAndNames) {
  var nameLevel = getNameLevel(classAndNames);
  var nonMasterLevels = classAndNames.levelNames.slice(0, nameLevel);
  var nonRepeatNames = nonMasterLevels.filter(isNotARepeatName);

  if (nonRepeatNames.some(containsFallbacks)) {
    // Drop anything that contains fallbacks.
    return 0;
  }
  else {
    return nonRepeatNames.length;
  }
}

var subordinatePrefixes = [
  'Junior',
  'Apprentice',
  'Assistant',
  'Associate',
  'Minor',
  'Novice',
  'Cadet',
  'Student',
  'Trainee',
  'Intern',
  'Lesser'
];

var repeatNameRegex = /\(\d+(th|st|nd|rd) level\)/;

function isNotARepeatName(name) {
  return !name.match(repeatNameRegex);
}

var prefixesWithSpaces = subordinatePrefixes.map(addSpace);

function addSpace(s) {
  return s + ' ';
}

function containsFallbacks(levelName) {
  function nameStartsWithPrefix(prefix) {
    return levelName.indexOf(prefix) === 0;
  }
  return prefixesWithSpaces.some(nameStartsWithPrefix);
}

function getNameLevel(classProfile) {
  var lowerCaseClassNames = classProfile.levelNames.map(lowerCaseIt);
  return lowerCaseClassNames.indexOf(classProfile.className.toLowerCase()) + 1;
}

function lowerCaseIt(s) {
  return s.toLowerCase();
}

module.exports = countUniqueLevels;
