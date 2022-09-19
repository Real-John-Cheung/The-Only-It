// JohnC 2022
// A customized markov chain model based on the one used in https://rednoise.org/rita

import Mt from "./mt";

const randomnizer = new Mt();


class Markov { 
    constructor(opts = {}) {
        this.n = opts.n || 3; //default n is 3
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