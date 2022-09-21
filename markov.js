// JohnC 2022
// A customized markov chain model based on the one used in https://rednoise.org/rita

import Mt from "./mt";

const randomnizer = new Mt();


class Markov {
    constructor(opts = {}) {
        this.n = opts.n || 3; //default n is 3
        this.root = new Node(null, "ROOT");
        this.maxAttempts = opts.maxAttempts || 999;
        this.sentenceStarts = [];
        this.sentenceEnds = new Set();
        if (opts.text) this.addText(opts.text);
    }

    addText(text, multiplier = 1) {
        // ideal data structure of text: [[token,token,...],[token,token,...]]
        // if input is a string, define token separater:'/', sentence separater: ';'
        if (typeof text === 'string') text = this.processRawText(text);

        let allTokens = [];
        for (let k = 0; k < multiplier; k++) {
            for (let i = 0; i < text.length; i++) {
                let tokens = text[i];
                this.sentenceStarts.push(tokens[0]);
                this.sentenceEnds.add(tokens[tokens.length - 1]);
                allTokens.push(...tokens);
            }
            this.treeify(allTokens);
        }
    }

    treeify(tokens) {
        let root = this.root;
        for (let i = 0; i < tokens.length; i++) {
            let node = root;
            let fragment = tokens.slice(i, i + this.n);
            let wrap = 0;
            for (let j = 0; j < this.n; j++) {
                let hidden = false;
                if (j >= fragment.length) {
                    fragment[j] = tokens[wrap++];
                    hidden = true
                }
                node = node.addChild(fragment[j]);
                if (hidden) node.hidden = true;
            }
        }
    }

    * generate(count, opts = {}) {
        // this generator yield a token each time, if count < 0, do it endlessly
        // to smooth the outcome time, a buffer should be used

        const num = count < 0 ? true : count;

        let tries = 0, tokens = [], usedStarts = [];
        let minIdx = 0, sentenceIdxs = [];
        let markedNodes = [];

        const unmarkNodes = () => {
            markedNodes.forEach(n => n.marked = false);
        }

        const markNode = (node) => {
            if (node) {
                node.marked = tokens.reduce((acc, e) => acc + e.token, '');
                markedNodes.push(node);
            }
        }

        const resultCount = () => {
            return tokens.filter(t => this._isEnd(t)).length;
        }

        const notMarked = (cn) => {
            let tmap = tokens.reduce((acc, e) => acc + e.token, '');
            return cn.marked !== tmap;
        }

        const fail = (msg, sentence, forceBacktrack) => {
            tries++;
            let sentIdx = sentenceIdx(); //?
            sentence = sentence || this._flatten(tokens.slice(sentIdx)); //?
            if (tries >= this.maxAttempts) throwError(tries, resultCount()); //?

            let parent = this._pathTo(tokens);
            let numOfChildren = parent ? parent.childNodes({ filter: notMarked }).length : 0;

            if (forceBacktrack || numOfChildren === 0) {
                backtrack();
            }
        }

        const backtrack = () => {
            let parent, tc;
            for (let i = 0; i < 99; i++) {
                let last = tokens.pop();
                markNode(last);

                if (this._isEnd(last)) sentenceIdxs.pop(); //?
                let sentIdx = sentenceIdx();
                let backtrackUntil = Math.max(sentIdx, minIdx);

                parent = this._pathTo(tokens);
                tc = parent.childNodes({ filter: notMarked });

                if (tokens.length <= backtrackUntil) {

                    if (minIdx > 0) { // have seed
                        if (tokens.length <= minIdx) { // back at seed
                            if (!tc.length) throw Error('back at barren-seed1: case 0');
                            return true;
                        }
                        else { // back at sentence-start with seed
                            if (!tc.length) {
                                sentenceIdxs.pop();
                            }
                            else {  // continue
                            }
                        }
                    }
                    else {             // TODO: recheck
                        if (!tokens.length) {
                            sentenceIdxs = [];
                            return selectStart();
                        }
                    }

                    return true;
                }

                if (tc.length) {
                    sentIdx = sentenceIdx();
                    return parent;
                }
            }

            throw Error('Invalid state in backtrack() [' + tokens.map(t => t.token) + ']');
        }

        const sentenceIdx = () => {
            let len = sentenceIdxs.length;
            return len ? sentenceIdxs[len - 1] : 0;
        }

        const selectStart = () => {
            let seed = opts.seed;
            // seed: ["token","token", ...], raw text: devided by '/'
            if (seed && seed.length) {
                if (typeof seed === 'string') seed = seed.split("/");
                let node = this._pathTo(seed, this.root);
                while (!node.isRoot()) {
                    tokens.unshift(node);
                    node = node.parent;
                }
            } else if (!tokens.length || this._isEnd(tokens[tokens.length - 1])) {
                let usableStarts = this.sentenceStarts.filter(ss => notMarked(this.root.child(ss)));
                if (!usableStarts.length) throw Error('No valid sentence-starts remaining');
                let start = randomnizer.random(usableStarts);
                let startTok = this.root.child(start);
                markNode(startTok);
                usableStarts = this.sentenceStarts.filter(ss => notMarked(this.root.child(ss)));
                tokens.push(startTok);
            } else {
                throw Error('Invalid call to selectStart: ' + this._flatten(tokens));
            }
        }
        //----------------------------------------------------------------------

        selectStart();

        // start generating
        let endless = num === true
        while (endless || resultCount() < num) {
           // TODO
        }
    }

    processRawText(raw) {
        let expanded = raw.split(";");
        for (let i = 0; i < expanded.length; i++) {
            expanded[i] = expanded[i].split("/");
        }
        return expanded;
    }


    _pathTo() {

    }

    _flatten() {

    }

    _isEnd() {

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

export default Markov