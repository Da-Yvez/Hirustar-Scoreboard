// ============================================================
//  HIRUSTAR SCOREBOARD — DATA CONFIGURATION
//  Edit contestant names, images, and starting scores here.
//  Judge images go in public/images/judges/
//  Contestant images go in public/images/contestants/
// ============================================================

const contestants = [
  { id: 1,  name: "Aria Patel",      image: "contestant_1.png", score: 0 },
  { id: 2,  name: "Leo Cruz",        image: "contestant_2.png", score: 0 },
  { id: 3,  name: "Zara Khan",       image: "contestant_3.png", score: 0 },
  { id: 4,  name: "Rohan Mehta",     image: "contestant_4.png", score: 0 },
  { id: 5,  name: "Sofia Ray",       image: "contestant_5.png", score: 0 },
  { id: 6,  name: "Dev Sharma",      image: "contestant_6.png", score: 0 },
  { id: 7,  name: "Nisha Verma",     image: "contestant_7.png", score: 0 },
  { id: 8,  name: "Aryan Bose",      image: "contestant_8.png", score: 0 },
  { id: 9,  name: "Priya Nair",      image: "contestant_9.png", score: 0 },
  { id: 10, name: "Kiran Das",       image: "contestant_10.png", score: 0 },
];

const judges = [
  { id: 1, name: "Judge Ravi",  image: "judge_1.png" },
  { id: 2, name: "Judge Meera", image: "judge_2.png" },
  { id: 3, name: "Judge Sam",   image: "judge_3.png" },
];

module.exports = { contestants, judges };
