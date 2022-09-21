import Markov from "./markov.js";

let testRaw = "這/是/一個/測試；兩個/句子"

let model = Markov.makeModel({ n: 2, text: testRaw });

console.log(model);

let m = new Markov({ model: model });

console.log(m.models[0]);