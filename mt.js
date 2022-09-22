// (c) JohnC 2022
// a customised Mersenne Twister based on:
// the Mersenne Twister used in https://rednoise.org/rita
// and https://github.com/bmurray7/mersenne-twister-examples/blob/master/javascript-mersenne-twister.js 

export default class Mt {
    constructor() {
        this.N = 624;
        this.M = 397;
        this.MATRIX_A = 0x9908b0df;   /* constant vector a */
        this.UPPER_MASK = 0x80000000; /* most significant w-r bits */
        this.LOWER_MASK = 0x7fffffff; /* least significant r bits */
        this.mt = new Array(this.N); /* the array for the state vector */
        this.mti = this.N + 1; /* mti==N+1 means mt[N] is not initialized */

        this.init(new Date().getTime());
    }

    init(seed) {
        this.mt[0] = seed >>> 0;
        for (this.mti = 1; this.mti < this.N; this.mti++) {
            let s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
            this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) +
                (s & 0x0000ffff) * 1812433253) + this.mti;
            this.mt[this.mti] >>>= 0;
        }
    }

    random() {
        let rawF = this._rndf();
        if (!arguments.length) return rawF;
        if (Array.isArray(arguments[0])) {
            let a = arguments[0];
            return a[Math.floor(rawF * a.length)];
        }
        return arguments.length === 1 ? rawF * arguments[0] : rawF * (arguments[1] - arguments[0]) + arguments[0];
    }

    randomInt() {
        let rawI = this._rndi();
        if (!arguments.length) return rawI;
        return arguments.length === 1 ? this._mapInt(rawI, 0, 4294967296, 0, arguments[0]) : this._mapInt(rawI, 0, 4294967296, arguments[0], arguments[1]);
    }

    selectNomralised(weights) {
        if (!weights || !weights.length) throw Error('[selectNormailsed]: weights required')
        let p = this._rndf(), cutoff = 0;
        for (let i = 0; i < weights.length; ++i) {
            cutoff += weights[i];
            if (p < cutoff) return [i];
        }
        return weights.length - 1;
    }

    normalise(weights, temp) {
        let res = [], sum = 0;
        if (!temp) {
            for (let i = 0; i < weights.length; i++) {  
                if (weights[0] < 0) throw Error("[normalise]: weights must be positive");
                sum += weights[i];
                res.push(weights[i]);
            }
        } else {
            if (temp < 0.01) temp = 0.01;
            for (let i = 0; i < weights.length; i++) {
                let pr = Math.exp(weights[i] / temp);
                sum += pr;
                res.push(pr);
            }
        }
        return res.map(p => p / sum);
    }

    selectGeneral(weights) {
        let sum = weights.reduce((acc, ele) => acc + ele, 0);
        let rand = this._rndf() * sum; 
        return weights.find(ele => (rand -= ele) < 0);
    }

    //useful?
    shuffle(ori) {
        let res = ori.slice();
        let l = res.length, i = l;
        while (i--) {
            let r = this.randomInt(l);
            let t = res[i];
            res[i] = res[r];
            res[r] = t;
        }
        return res;
    }

    //--------------- not exposing -------------------
    /*
        return int 0 < MAXINT 4294967296
    */
    _rndi() {
        let y, kk, mag01 = new Array(0x0, this.MATRIX_A);
        if (this.mti >= this.N) {
            if (this.mti == this.N + 1) this.seed(5489);
            for (kk = 0; kk < this.N - this.M; kk++) {
                y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            for (; kk < this.N - 1; kk++) {
                y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            y = (this.mt[this.N - 1] & this.UPPER_MASK) | (this.mt[0] & this.LOWER_MASK);
            this.mt[this.N - 1] = this.mt[this.M - 1] ^ (y >>> 1) ^ mag01[y & 0x1];
            this.mti = 0;
        }
        y = this.mt[this.mti++];
        y ^= (y >>> 11);
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= (y >>> 18);
        return y >>> 0;
    }

    _rndf() {
        return this._rndi() * (1.0 / 4294967296.0);
    }

    _mapInt(ori, inL, inH, outL, outH) {
        return Math.floor(((ori - inL) / (inH - inL)) * (outH - outL) + outL);
    }
}