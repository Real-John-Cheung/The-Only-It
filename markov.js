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

            // if (forceBacktrack || numOfChildren === 0) {
            //     backtrack();
            // }
        }

        const backtrack = () => {
            // no backtrack
            let parent, tc;
            for (let i = 0; i < 99; i++) {
                let last = tokens.pop();
                markNode(last);

                //if (this._isEnd(last)) sentenceIdxs.pop();

                //
            }
        }

        const sentenceIdx = () => {
            let len = sentenceIdxs.length;
            return len ? sentenceIdxs[len - 1] : 0;
        }

        const selectStart = () => {
            let seed = opts.seed;
            if (seed && seed.length) {
                if (typeof seed === 'string') seed = this.tokenize(seed);
                let node = this._pathTo(seed, this.root);
                while (!node.isRoot()) {
                    tokens.unshift(node);
                    node = node.parent;
                }
            }
            else if (!tokens.length || this._isEnd(tokens[tokens.length - 1])) {
                let usableStarts = this.sentenceStarts.filter(ss => notMarked(this.root.child(ss)));
                if (!usableStarts.length) throw Error('No valid sentence-starts remaining');
                let start = RiTa().random(usableStarts);
                let startTok = this.root.child(start);
                markNode(startTok);
                usableStarts = this.sentenceStarts.filter(ss => notMarked(this.root.child(ss)));
                tokens.push(startTok);
            } else {

            }
        }

        ////////////////////////////////////// //////////////////////
        selectStart();

        while (!opts.exitCondition) {
            let parent = this._pathTo(tokens);
            let next = this._selectNext(parent, opts.temperature, tokens, notMarked);

            if (!next) {
                fail();
                continue;
            }

            tokens.push(next);
            yield next.token;
            if (tokens.length > 100) unmarkNodes();
        }

    }

    _pathTo(path, root) {
        root = root || this.root;
        if (typeof path === 'string') path = [path];
        if (!path || !path.length || this.n < 2) return root;
        let idx = Math.max(0, path.length - (this.n - 1));
        let node = root.child(path[idx++]);
        for (let i = idx; i < path.length; i++) {
            if (node) node = node.child(path[i]);
        }
        return node; // can be undefined
    }

    _selectNext(parent, tenp, tokens, filter) {
        if (!parent) throw new Error("[_selectNext]: no parent! at: " + this._flatten(tokens));
        let children = parent.childNodes({ filter });
        if (!children.length) return;

        return parent.pselect(filter);
    }

    _flatten(nodes) {
        if (!nodes || (Array.isArray(nodes) && !nodes.length)) return '';
        if (nodes.token) return nodes.token; // single-node 
        let arr = nodes.map(n => n ? n.token : '[undef]');
        let sent = this.untokenize(arr);
        return sent.replace(/\s+/, ' ');
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