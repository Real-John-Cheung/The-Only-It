// (c) JohnC 2022
// A customized markov chain model based on the one used in https://rednoise.org/rita

import Mt from "./mt.js";
import { parse, stringify } from "./flatted.js";

function isSubArray(find, arr) {
    if (!arr || !arr.length) return false;
    OUT: for (let i = find.length - 1; i < arr.length; i++) {
        for (let j = 0; j < find.length; j++) {
            if (find[find.length - j - 1] !== arr[i - j]) continue OUT;
            if (j === find.length - 1) return true;
        }
    }
    return false;
}

const randomnizer = new Mt();
const sentenceSeparater = ";";
const tokenSeparater = "/";

/*
    static makeModel(): treeify the model and return an object (in json)
    constructor():
    loadModel(): add model to a list of models
    * generate(): generate from the models
*/

class Markov {

    static makeModel(opts = {}) {
        const root = new Node(null, "ROOT");
        const n = opts.n || 3
        const text = opts.text;
        const multiplier = opts.multiplier || 1;
        const sentenceStarts = [];
        const sentenceEnds = new Set();
        if (!text || !text.length) throw Error("[makeModel]: text is require for making model");
        // ideal format of text: [['token','token',...],[]...]
        const processText = (raw) => {
            let r = raw.split(sentenceSeparater);
            for (let i = 0; i < r.length; i++) {
                r[i] = r[i].split(tokenSeparater);
            }
            return r;
        }
        let sents = Array.isArray(text) ? text : processText(text);
        let wrap, allTokens = [];
        for (let k = 0; k < multiplier; k++) {
            for (let i = 0; i < sents.length; i++) {
                let tokens = sents[i];
                sentenceStarts.push(tokens[0]);
                sentenceEnds.add(tokens[tokens.length - 1]);
                allTokens.push(...tokens);
            }
            // treeify
            for (let i = 0; i < allTokens.length; i++) {
                let node = root;
                let fragment = allTokens.slice(i, i + n);
                let wrap = 0;
                for (let j = 0; j < n; j++) {
                    let hidden = false;
                    if (j >= fragment.length) {
                        fragment[j] = allTokens[wrap++];
                        hidden = true;
                    }
                    node = node.addChild(fragment[j]);
                    if (hidden) node.hidden = true;
                }
            }
        }

        // packing
        let meta = {
            n: n,
            sentenceStarts: sentenceStarts,
            sentenceEnds: [...sentenceEnds], //set => array for packing
        }
        /*
        {
            meta: {
                n:number,
                sentenceStarts:[],
                sentenceEnds:[]
            }
            root: Node
        }
        */

        let model = {
            meta: meta,
            root: root
        }

        let data = Object.keys(model).reduce((acc, k) => Object.assign(acc, { [k]: model[k] }), {});
        console.log(data);
        return stringify(data);
    }

    constructor(opts = {}) {
        this.maxAttempts = opts.maxAttempts || 999;
        if (opts.model) this.loadModel(opts.model);
    }

    loadModel(model) {
        let parsed = parse(model);
        this.sentenceEnds = new Set(...parsed.meta.sentenceEnds)
        this.sentenceStarts = parsed.meta.sentenceStarts.slice();
        this.n = parsed.meta.n;

        this.root = new Node(null, "ROOT");
        populate(this.root, parsed.root);
    }

    * generate(seed, terminateToken, opts = {}) {
        const lookBackLength = opts.lookBackLength || 5
        const minLength = opts.minLength || 10;
        let tries = 0, tokens = [], usedStarts = [];
        let count = 0;
        let markedNodes = [];
        //----------------------------------
        const unmarkNodes = () => {
            markedNodes.forEach(n => n.marked = false);
        }

        const markNode = (node) => {
            if (node) {
                node.marked = tokens.reduce((acc, e) => acc + e.token, '');
                markedNodes.push(node);
            }
        }

        const notMarked = (cn) => {
            let tmap = tokens.reduce((acc, e) => acc + e.token, '');
            return cn.marked !== tmap;
        }

        const validate = (next) => {
            markNode(next);
            let slice = tokens.slice(tokens.length - lookBackLength).map(t => t.token);
            slice.push(next.token);

            if (!opts.allowDuplicates && isSubArray(slice, tokens.slice(0, tokens.length - lookBackLength).map(t => t.token))) {
                fail();
                return false;
            }

            tokens.push(next);
            return true;
        }

        const fail = (forceBacktrack) => {
            tries++;
            if (tries >= this.maxAttempts) throw Error("[fail]: reach maxArrempts");
            let parent = this._pathTo(tokens);
            let numOfChildren = parent ? parent.childNodes({ filter: notMarked }).length : 0;

            if (forceBacktrack || numOfChildren === 0) {
                backtrack();
            }
        }

        const backtrack = () => {
            //?
        }
    }

    _pathTo() {
        
    }
}

class Node {
    constructor(parent, token, count) {
        this.children = {};
        this.parent = parent;
        this.token = token;
        this.count = count || 0; //start with 0
        this.numOfChildren = -1; //no overflow
        this.marked = false;
    }

    child(word) {
        let txt = word;
        if (word.token) txt = word.token;
        return this.children[txt];
    }

    pselect(filter) {
        const children = this.childNodes({ filter });
        if (!children.length) throw Error('No eligible child for "' + this.token + "\" children=[" + this.childNodes().map(t => t.token) + "]");
        const weights = children.map(n => n.count);
        const idx = randomnizer.selectGeneral(weights);
        return children[idx];
    }

    isLeaf(ignoreHidden) {
        return this.childCount(ignoreHidden) < 1;
    }

    isRoot() {
        return !this.parent;
    }

    childNodes(opts) {
        let sort = opts && opts.sort;
        let filter = opts && opts.filter;
        let kids = Object.values(this.children);
        if (filter) kids = kids.filter(filter);
        if (sort) kids = kids.sort((a, b) => b.count !== a.count ? b.count - a.count : b.token.localeCompare(a.token));
        return kids;
    }

    childCount(ignoreHidden) {
        if (this.numOfChildren === -1) {
            let opts = {};
            if (ignoreHidden) opts.filter = (t => !t.hidden);
            this.numOfChildren = this.childNodes(opts).reduce((a, c) => a + c.count, 0);
        }
        return this.numOfChildren;
    }

    addChild(token, count) {
        this.numOfChildren = -1;
        count = count || 1;
        let node = this.children[token];
        if (!node) {
            node = new Node(this, token);
            this.children[token] = node;
        }
        node.count += count;
        return node;
    }
}

function populate(objNode, jsonNode) {
    if (!jsonNode) return;
    let children = Object.values(jsonNode.children);
    for (let i = 0; i < children.length; i++) {
        let child = children[i];
        let newNode = objNode.addChild(child.token, child.count);
        populate(newNode, child);
    }
}

export default Markov