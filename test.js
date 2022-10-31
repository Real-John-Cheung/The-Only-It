import Markov from "./markov.js";

let testRaw = "這/是/一個/測試；兩個/句子;是/什麼/意思；這/人/有/什麼/問題；這/程式/不能/運行;這/世界/在/崩潰；我們/的/世界/有/問題/出現"

let model = Markov.makeModel({ n: 2, text: testRaw });

let m = new Markov({ model: model });

console.log(m.sentenceStarts);
console.log(m.sentenceEnds);

let generator = m.generate({seed: ["這"]});

console.log(generator.next().value);
console.log(generator.next().value);
console.log(generator.next().value);
console.log(generator.next().value);
console.log(generator.next().value);
console.log(generator.next().value);
console.log(generator.next().value);
console.log(generator.next().value);

generator.return();