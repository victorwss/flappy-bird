"use strict";

const FASE_INICIAL = 1;
const FASES_ABERTAS = 13;
const SOM = "mp3";

function randomInt(a, b) {
    if (b < a) [a, b] = [b, a];
    return Math.floor(Math.random() * (b - a)) + a;
}

Array.prototype.randomElement = function randomElement() {
    return this[randomInt(0, this.length)];
};

class Fase {
    #espacoVertical;
    #larguraObstaculos;
    #distanciaObstaculos;
    #numeroObstaculos;
    #vy;
    #vx;
    #gravidade;
    #claro;
    #medio;
    #escuro;

    get espacoVertical     () { return this.#espacoVertical     ; }
    get larguraObstaculos  () { return this.#larguraObstaculos  ; }
    get distanciaObstaculos() { return this.#distanciaObstaculos; }
    get numeroObstaculos   () { return this.#numeroObstaculos   ; }
    get gravidade          () { return this.#gravidade          ; }
    get vx                 () { return this.#vx                 ; }
    get vy                 () { return this.#vy                 ; }
    get claro              () { return this.#claro              ; }
    get medio              () { return this.#medio              ; }
    get escuro             () { return this.#escuro             ; }

    constructor(espacoVertical, vx, vy, larguraObstaculos, numeroObstaculos, distanciaObstaculos, gravidade, claro, medio, escuro) {
        this.#espacoVertical = espacoVertical;
        this.#larguraObstaculos = larguraObstaculos;
        this.#distanciaObstaculos = distanciaObstaculos;
        this.#numeroObstaculos = numeroObstaculos;
        this.#vx = vx;
        this.#vy = vy;
        this.#gravidade = gravidade;
        this.#claro = claro;
        this.#medio = medio;
        this.#escuro = escuro;
    }
}

const FASES = [
    new Fase(200, 100,  0,  30, 10, 200, 200, "rgb(255,255,255)", "rgb(144,144,144)", "black"), // até 10
    new Fase(190, 110,  0,  36, 11, 200, 220, "rgb(255,192,224)", "rgb(255,128,192)", "black"), // até 21
    new Fase(180, 120, 10,  42, 12, 220, 240, "rgb(192,192,255)", "rgb(128,128,255)", "black"), // até 33
    new Fase(170, 130, 15,  48, 13, 220, 260, "rgb(192,255,255)", "rgb(0,255,255)"  , "black"), // até 46
    new Fase(165, 140, 20,  54, 14, 240, 280, "rgb(128,255,128)", "rgb(0,255,0)"    , "black"), // até 60
    new Fase(160, 150, 25,  60, 17, 240, 300, "rgb(255,255,0)"  , "rgb(192,192,0)"  , "black"), // até 77
    new Fase(155, 160, 30,  66, 23, 230, 325, "rgb(255,192,128)", "rgb(255,128,0)"  , "black"), // até 100
    new Fase(150, 170, 35,  72, 25, 230, 350, "rgb(255,128,128)", "rgb(255,0,0)"    , "black"), // até 125
    new Fase(145, 180, 40,  76, 33, 240, 375, "rgb(144,72,0)"   , "rgb(96,48,0)"    , "white"), // até 158
    new Fase(140, 190, 47,  80, 42, 250, 400, "rgb(128,128,128)", "rgb(64,64,64)"   , "white"), // até 200
    new Fase(130, 200, 54,  80, 50, 240, 500, "red"             , "lime"            , "black"), // até 250
    new Fase(120, 210, 61,  80, 50, 230, 700, "blue"            , "yellow "         , "white")  // até 300
];

const [ALTURA_TOTAL, LARGURA_TOTAL] = [500, 750];
const [FOLGA_CHAO, FOLGA_TETO, ALTURA_CHAO, ALTURA_TETO] = [50, 50, ALTURA_TOTAL - 50, 50];
const [X_PASSARINHO, MUITO_GRANDE] = [100, 999999];
const IMPULSO_INICIAL = -200;
const IMPULSO_FLAP = -200;
const IMPULSO_MAXIMO = -1200;
const RAIO_PASSARINHO = 20;
const VELOCIDADE_VOO_AO_CENTRO = FASES.at(-1).vx;
const VELOCIDADE_TERMINAL = 4000;
const TEMPO_FLAP = 0.1;
const SUAVIZACAO_TRANSPARENCIA = 1 / 256;

class BibliotecaImagens {
    #nomes;
    #imagens;
    #loaders;

    constructor(nomes) {
        this.#nomes = [...nomes];
        this.#imagens = {};
        this.#loaders = {};

        for (const src of nomes) {
            this.#loaders[src] = new Promise((resolve, reject) => {
                let img = new Image();
                this.#imagens[src] = img;
                img.onload = () => {
                    resolve(img);
                }
                img.onerror = reject;
                img.src = src;
            });
        }
    }

    async aguardarImagens() {
        for (const src in this.#loaders) {
            await this.#loaders[src];
        }
    }

    imagem(nome) {
        return this.#imagens[nome];
    }
}

class Mundo {

    #callbacks;
    #passarinho;
    #pares;
    #obstaculos;
    #chao;
    #teto;
    #acumulado;
    #fasesSuperadas;
    #transicaoFase;
    #fundos;

    constructor(fase, fundos, callbacks) {
        this.#callbacks = callbacks;
        this.#chao = new Chao(this);
        this.#teto = new Teto(this);
        this.#fasesSuperadas = fase - 1;
        this.#transicaoFase = 1;
        this.#fundos = fundos;

        this.#acumulado = 0;
        for (let i = 0; i < this.#fasesSuperadas; i++) {
            this.#acumulado += FASES[i].numeroObstaculos;
        }
        this.#pares = [];
        this.#obstaculos = [ this.#chao, this.#teto ];

        let passou = 0;
        for (let f = 0; f < this.#fasesSuperadas; f++) {
            passou += FASES[f].numeroObstaculos;
        }

        let x1 = X_PASSARINHO;
        for (let f = this.#fasesSuperadas; f < FASES.length; f++) {
            const fase = FASES[f];

            for (let i = 0; i < fase.numeroObstaculos; i++) {
                x1 += fase.distanciaObstaculos;
                passou++;
                const par = new Par(this, fase, x1, passou);
                this.#pares.push(par);
                this.#obstaculos.push(par.ob1, par.ob2);
            }
        }

        this.#passarinho = new Passarinho(this, X_PASSARINHO, this.alturaCentro);
        if (this.ganhou) {
            callbacks.ganhou();
        } else {
            callbacks.comecou();
        }
        console.log(this.alturaTeto - this.alturaChao);
    }

    get pontos() {
        return this.#pares.reduce((a, p) => a + (this.#passarinho.x - this.#passarinho.raio > p.ob1.x2 ? 1 : 0), 0);
    }

    get vx() {
        return FASES[Math.min(this.#fasesSuperadas, FASES.length - 1)].vx;
    }

    get callbacks   () { return this.#callbacks                        ; }
    get gravidade   () { return FASES[this.#fasesSuperadas].gravidade  ; }
    get alturaChao  () { return ALTURA_CHAO                            ; }
    get alturaTeto  () { return ALTURA_TETO                            ; }
    get alturaCentro() { return (this.alturaTeto + this.alturaChao) / 2; }
    get altura      () { return ALTURA_TOTAL                           ; }
    get largura     () { return LARGURA_TOTAL                          ; }
    get obstaculos  () { return this.#obstaculos                       ; }
    get numeroFase  () { return this.#fasesSuperadas + 1               ; }
    get fase        () { return FASES[this.#fasesSuperadas]            ; }
    get ganhou      () { return this.#fasesSuperadas === FASES.length  ; }
    get offX        () { return this.#passarinho.x - X_PASSARINHO      ; }
    get offY        () { return 0                                      ; }

    flap() {
        this.#passarinho.flap();
    }

    tick(deltaT) {
        if (this.#transicaoFase < 1) this.#transicaoFase += SUAVIZACAO_TRANSPARENCIA;
        for (const p of this.#pares) {
            p.tick(deltaT);
        }
        this.#passarinho.tick(deltaT);
        const pts = this.pontos;
        if (this.ganhou) return;
        if (this.#acumulado !== pts) {
            this.#acumulado = pts;
            if (pts === this.#pares.length) {
                this.#fasesSuperadas++;
                this.#transicaoFase = 0;
                this.#callbacks.ganhou();
            } else if (pts > 0 && this.#pares[pts].fase !== this.#pares[pts - 1].fase) {
                this.#fasesSuperadas++;
                this.#transicaoFase = 0;
                this.#callbacks.passouDeFase(this.#fasesSuperadas + 1);
            } else {
                this.#callbacks.pontuou();
            }
        }
    }

    #desenharFundo(ctx) {
        const fundo = this.#fundos.imagem(`img/fase${this.numeroFase}.png`);
        const fundoVelho = this.numeroFase === 1 ? null : this.#fundos.imagem(`img/fase${this.numeroFase - 1}.png`);

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, this.largura, this.altura);

        ctx.globalAlpha = this.#transicaoFase;
        ctx.drawImage(fundo, 0, this.alturaTeto, this.largura, this.alturaChao - this.alturaTeto);

        if (fundoVelho) {
            ctx.globalAlpha = 1 - this.#transicaoFase;
            ctx.drawImage(fundoVelho, 0, this.alturaTeto, this.largura, this.alturaChao - this.alturaTeto);
        }

        ctx.globalAlpha = 1.0;
    }

    desenhar(ctx) {
        ctx.save();
        try {
            this.#desenharFundo(ctx);
            for (const p of this.#obstaculos) {
                p.desenhar(ctx);
            }
            this.#passarinho.desenhar(ctx);
            ctx.fillStyle = "white";
            ctx.font = "30px serif";
            const t = `Fase: ${this.numeroFase}`;
            ctx.fillText(t, (this.largura - ctx.measureText(t).width) / 2, this.altura - 15);
        } finally {
            ctx.restore();
        }
    }
}

class Passarinho {
    #x;
    #y;
    #vy;
    #vivo;
    #asas;
    #mundo;
    #cor;
    #corOlho;

    get x   () { return this.#x        ; }
    get y   () { return this.#y        ; }
    get raio() { return RAIO_PASSARINHO; }
    get vivo() { return this.#vivo     ; }

    constructor(mundo, x, y) {
        this.#x = x;
        this.#y = y;
        this.#vy = IMPULSO_INICIAL;
        this.#vivo = true;
        this.#asas = 0;
        this.#mundo = mundo;
        this.#cor = ["rgb(255,255,64)", "rgb(255,128,128)", "rgb(128,128,255)", "rgb(128,255,128)", "rgb(224,224,224)"].randomElement();
        this.#corOlho = ["cyan", "lime", "black", "red", "rgb(128,64,0)"].randomElement();
    }

    get #inclinacao() {
        if (this.#mundo.ganhou) return 0;
        const [vx, vy] = [this.#mundo.vx, this.#vy];
        if (!this.vivo && vy === 0) return Math.PI / 2;
        const hipotenusa = Math.sqrt(vx ** 2 + vy ** 2);
        if (hipotenusa === 0) return 0;
        const seno = vy / hipotenusa;
        return Math.asin(seno);
    }

    flap() {
        if (this.vivo && this.#asas === 0) this.#asas = TEMPO_FLAP;
    }

    tick(deltaT) {
        const mundo = this.#mundo;

        if (mundo.ganhou) {
            this.#voarAoCentro(deltaT);
            return;
        }

        if (this.vivo && this.#asas === TEMPO_FLAP) {
            this.#vy += IMPULSO_FLAP;
            mundo.callbacks.bateuAsas();
        }
        this.#asas -= deltaT / 1000;
        if (this.#asas < 0) this.#asas = 0;

        this.#vy += (mundo.gravidade * deltaT / 1000);
        if (this.#vy > VELOCIDADE_TERMINAL) this.#vy = VELOCIDADE_TERMINAL;
        if (this.#vy < IMPULSO_MAXIMO) this.#vy = IMPULSO_MAXIMO;
        if (this.vivo) this.#x += (mundo.vx * deltaT / 1000);
        this.#y += (this.#vy * deltaT / 1000);

        this.#testarColisao();

        if (this.#y + this.raio > mundo.alturaChao) {
            this.#y = mundo.alturaChao - this.raio;
            this.#vy = 0;
        }
        if (this.#y - this.raio < mundo.alturaTeto) {
            this.#y = mundo.alturaTeto + this.raio;
            this.#vy = 0;
        }
    }

    #voarAoCentro(deltaT) {
        const mundo = this.#mundo;
        const alturaDestino = mundo.alturaChao - this.raio - 5;
        this.#vy = 0;
        const dv = VELOCIDADE_VOO_AO_CENTRO * deltaT / 1000;
        this.#x += dv;
        if (alturaDestino < this.#y - dv) {
            this.#y -= dv;
            this.#asas = 1;
        } else if (alturaDestino > this.#y + dv) {
            this.#y += dv;
            this.#asas = 1;
        } else {
            this.#y = alturaDestino;
            this.#asas = 0;
        }
    }

    #testarColisao() {
        const mundo = this.#mundo;
        if (!this.vivo || !mundo.obstaculos.some(ob => ob.colide(this.#x, this.#y, this.raio))) return;
        mundo.callbacks.morreu();
        this.#vivo = false;
    }

    desenhar(ctx) {
        const desenharCauda = () => {
            ctx.lineWidth = 2;
            ctx.strokeStyle = "black";
            ctx.fillStyle = this.#cor;
            ctx.beginPath();
            ctx.moveTo(-this.raio     ,   0);
            ctx.lineTo(-this.raio - 20,  -5);
            ctx.lineTo(-this.raio - 20, -15);
            ctx.lineTo(0, 0);
            ctx.stroke();
            ctx.fill();
        };

        const desenharCorpo = () => {
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.raio, this.raio, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        };

        const desenharAsa = (x, y) => {
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "black";
            ctx.fillStyle = this.#cor;
            const altura = this.#asas ? -30 : 10;
            ctx.moveTo(x, y);
            ctx.lineTo(x - 15, altura + y);
            ctx.lineTo(x - 25, altura + y);
            ctx.lineTo(x - 20, y);
            ctx.lineTo(x - 10, y);
            ctx.stroke();
            ctx.fill();
        };

        const desenharBico = () => {
            ctx.lineWidth = 1;
            ctx.fillStyle = "rgb(192,64,64)";
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.raio, 0);
            ctx.lineTo(this.raio + 8, 5);
            ctx.lineTo(5, 5);
            ctx.moveTo(this.raio + 8, 5);
            ctx.lineTo(this.raio, 10);
            ctx.lineTo(5, 10);
            ctx.lineTo(0, 0);
            ctx.fill();
            ctx.stroke();
        };

        const desenharOlho = () => {
            /* córnea */
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.ellipse(this.raio / 2, -this.raio / 2, this.raio / 2, this.raio / 2, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            /* pupila */
            if (this.vivo) {
                ctx.strokeStyle = "black";
                ctx.fillStyle = this.#corOlho;
                ctx.beginPath();
                ctx.ellipse(3 * this.raio / 4, -this.raio / 2, this.raio / 4, this.raio / 4, 0, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.fill();
            } else {
                ctx.strokeStyle = "black";
                ctx.beginPath();
                ctx.moveTo(    this.raio / 4, -3 * this.raio / 4);
                ctx.lineTo(3 * this.raio / 4, -    this.raio / 4);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(    this.raio / 4, -    this.raio / 4);
                ctx.lineTo(3 * this.raio / 4, -3 * this.raio / 4);
                ctx.stroke();
            }
        };

        const desenharPe = x => {
            ctx.lineWidth = 2;
            ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.moveTo(x    , this.raio - 5);
            ctx.lineTo(x    , this.raio + 5);
            ctx.moveTo(x    , this.raio    );
            ctx.lineTo(x + 5, this.raio + 5);
            ctx.moveTo(x    , this.raio    );
            ctx.lineTo(x - 5, this.raio + 5);
            ctx.stroke();
        };

        const px = this.x - this.#mundo.offX;
        const py = this.y - this.#mundo.offY;
        ctx.save();
        try {
            ctx.translate(px, py);
            ctx.rotate(this.#inclinacao);
            desenharAsa(-7, 2);
            desenharPe(-5);
            desenharCauda();
            desenharCorpo();
            desenharAsa(-3, 0);
            desenharBico();
            desenharOlho();
            desenharPe(5);
        } finally {
            ctx.restore();
        }
    }
}

class Obstaculo {
    #mundo;
    #x1;
    #x2;
    #y1;
    #y2;

    constructor(mundo, x1, x2, y1, y2) {
        this.#mundo = mundo;
        this.#x1 = x1;
        this.#x2 = x2;
        this.#y1 = y1;
        this.#y2 = y2;
    }

    get mundo() { return this.#mundo; } 
    get x1   () { return this.#x1   ; }
    get x2   () { return this.#x2   ; }
    get y1   () { return this.#y1   ; }
    get y2   () { return this.#y2   ; }

    moveY1(delta) { this.#y1 += delta; }
    moveY2(delta) { this.#y2 += delta; }

    colide(xp, yp, r) {
        const [x1, x2, y1, y2] = [this.x1, this.x2, this.y1, this.y2];
        return (xp + r > x1 && xp - r < x2 && yp > y1 && yp < y2)
            || (yp + r > y1 && yp - r < y2 && xp > x1 && xp < x2)
            ||  Math.sqrt((xp - x1) ** 2 + (yp - y1) ** 2) < r
            ||  Math.sqrt((xp - x2) ** 2 + (yp - y1) ** 2) < r
            ||  Math.sqrt((xp - x1) ** 2 + (yp - y2) ** 2) < r
            ||  Math.sqrt((xp - x2) ** 2 + (yp - y2) ** 2) < r;
    }
}

class Tubo extends Obstaculo {
    #numero;
    #fase;

    constructor(mundo, x1, x2, y1, y2, numero, fase) {
        super(mundo, x1, x2, y1, y2);
        this.#numero = numero;
        this.#fase = fase;
    }

    get numero() { return this.#numero; }
    get fase  () { return this.#fase  ; }

    desenhar(ctx) {
        ctx.save();
        try {
            const m = this.mundo;
            const t = `${this.numero}`;
            ctx.font = "22px serif";
            const mt = ctx.measureText(t);
            const ty = this.textoY(mt);
            const vr = this.textoYC(mt);
            const [x, y, w, h] = [this.x1 - m.offX, this.y1 - m.offY, this.x2 - this.x1, this.y2 - this.y1];

            ctx.strokeStyle = "black";
            ctx.fillStyle = this.fase.medio;
            ctx.strokeRect(x, y, w, h);
            ctx.fillRect(x, y, w, h);

            ctx.fillStyle = this.fase.claro;
            ctx.beginPath();
            ctx.ellipse(x + w / 2, vr, Math.max(13, (mt.width + 5) / 2), 13, 0, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();

            ctx.fillStyle = this.fase.escuro;
            ctx.fillText(t, x + (w - mt.width) / 2, ty);
        } finally {
            ctx.restore();
        }
    }
}

class ObstaculoSuperior extends Tubo {

    constructor(mundo, x1, y2, numero, fase) {
        super(mundo, x1, x1 + fase.larguraObstaculos, mundo.alturaTeto, y2, numero, fase);
    }

    textoY(mt) { return this.y1 + mt.actualBoundingBoxAscent + 10; }

    textoYC(mt) { return this.y1 + (mt.actualBoundingBoxDescent + mt.actualBoundingBoxAscent) / 2 + 10; }
}

class ObstaculoInferior extends Tubo {

    constructor(mundo, x1, y1, numero, fase) {
        super(mundo, x1, x1 + fase.larguraObstaculos, y1, mundo.alturaChao, numero, fase);
    }

    textoY(mt) { return this.y2 - mt.actualBoundingBoxDescent - 10; }

    textoYC(mt) { return this.y2 - (mt.actualBoundingBoxDescent + mt.actualBoundingBoxAscent) / 2 - 10; }
}

class Par {
    #ob1;
    #ob2;
    #mundo;
    #fase;
    #sentido;

    get ob1 () { return this.#ob1 ; }
    get ob2 () { return this.#ob2 ; }
    get fase() { return this.#fase; }

    constructor(mundo, fase, x1, numero) {
        this.#fase = fase;
        this.#mundo = mundo;
        this.#sentido = [-1, 1].randomElement();

        const sobra = mundo.alturaChao - mundo.alturaTeto - fase.espacoVertical - FOLGA_CHAO - FOLGA_TETO;
        const ya = randomInt(0, sobra) + mundo.alturaTeto + FOLGA_TETO;
        const yb = ya + fase.espacoVertical;

        this.#ob1 = new ObstaculoSuperior(mundo, x1, ya, numero, fase);
        this.#ob2 = new ObstaculoInferior(mundo, x1, yb, numero, fase);
    }

    tick(deltaT) {
        const [c, t] = [this.#mundo.alturaChao, this.#mundo.alturaTeto];
        if (this.ob1.y2 < t + FOLGA_TETO || this.ob2.y1 > c - FOLGA_CHAO) this.#sentido *= -1;
        const delta = this.#sentido * this.#fase.vy * deltaT / 1000;
        this.ob1.moveY2(delta);
        this.ob2.moveY1(delta);
    }
}

class Chao extends Obstaculo {
    constructor(mundo) {
        super(mundo, -MUITO_GRANDE, MUITO_GRANDE, mundo.alturaChao, MUITO_GRANDE);
    }

    desenhar(ctx) {
        ctx.save();
        try {
            ctx.fillStyle = "green";
            ctx.strokeStyle = "green";
            ctx.fillRect(0, this.mundo.alturaChao, this.mundo.largura, this.mundo.altura - this.mundo.alturaChao);
        } finally {
            ctx.restore();
        }
    }
}

class Teto extends Obstaculo {
    constructor(mundo) {
        super(mundo, -MUITO_GRANDE, MUITO_GRANDE, -MUITO_GRANDE, mundo.alturaTeto);
    }

    desenhar(ctx) {
        ctx.save();
        try {
            ctx.fillStyle = "yellow";
            ctx.strokeStyle = "yellow";
            ctx.fillRect(0, 0, this.mundo.largura, this.mundo.alturaTeto);
        } finally {
            ctx.restore();
        }
    }
}

class Callbacks {
    #ganhou;
    #passouDeFase;
    #pontuou;
    #bateuAsas;
    #morreu;
    #comecou;

    get ganhou      () { return this.#ganhou      ; }
    get passouDeFase() { return this.#passouDeFase; }
    get pontuou     () { return this.#pontuou     ; }
    get bateuAsas   () { return this.#bateuAsas   ; }
    get morreu      () { return this.#morreu      ; }
    get comecou     () { return this.#comecou     ; }

    constructor(ganhou, passouDeFase, pontuou, bateuAsas, morreu, comecou) {
        this.#ganhou = ganhou;
        this.#passouDeFase = passouDeFase;
        this.#pontuou = pontuou;
        this.#bateuAsas = bateuAsas;
        this.#morreu = morreu;
        this.#comecou = comecou;
    }
}

class FlappyBird {

    #canvas;
    #mundo;
    #musica;
    #callbacks;
    #fundos;

    constructor(canvasId) {
        this.#callbacks = new Callbacks(
            () => this.#somGanhou(),
            fase => this.#somPassouFase(fase),
            () => {},
            () => this.#somBateAsas(),
            () => this.#somMorreu(),
            () => this.#somComecou()
        );

        window.onload = async () => {
            this.#canvas = document.getElementById(canvasId);
            this.#canvas.height = ALTURA_TOTAL;
            this.#canvas.width = LARGURA_TOTAL;

            const srcImagens = [];
            for (let i = 1; i <= FASES.length + 1; i++) {
                srcImagens.push(`img/fase${i}.png`);
            }
            this.#fundos = new BibliotecaImagens(srcImagens);
            await this.#fundos.aguardarImagens();

            this.#canvas.addEventListener("click", event => {
                if (event.defaultPrevented) return;
                this.#mundo.flap();
            }, {capture: true});

            let pressed = "";
            document.addEventListener("keydown", event => {
                if (event.defaultPrevented) return;
                if (["Enter", "Space"].includes(event.code)) {
                    if (pressed !== event.code) {
                        pressed = event.code;
                        this.#mundo.flap();
                    }
                    event.preventDefault();
                }
            }, {capture: true});

            document.addEventListener("keyup", event => {
                if (event.defaultPrevented) return;
                if (["Enter", "Space"].includes(event.code)) {
                    if (pressed === event.code) pressed = "";
                    event.preventDefault();
                }
            }, {capture: true});
            this.#criarBotoes();
            this.recomecar(FASE_INICIAL);
            mainLoop(10, () => this.#mundo.tick(10), () => this.#desenhar());
        };
    }

    #criarBotoes() {
        const buttons = document.getElementById("buttons");
        for (let i = 1; i <= FASES.length + 1; i++) {
            const txt = `<button type="button" ${i > FASES_ABERTAS ? "disabled" : ""} id="recomecar-${i}" onclick="flappy.recomecar(${i});">${i}</button>`;
            buttons.innerHTML += txt;
        }
    }

    #somPassouFase(fase) {
        const a = new Audio();
        a.src = `${SOM}/fase${fase}.${SOM}`;
        a.play();
        document.getElementById("recomecar-" + fase).removeAttribute("disabled");
    }

    #somComecou() {
        this.#musica?.pause();
        this.#musica = new Audio();
        this.#musica.src = `${SOM}/voarvoar.${SOM}`;
        this.#musica.onended = () => {
            this.#musica = new Audio();
            this.#musica.src = `${SOM}/Foo-Fighters-Learn-To-Fly.${SOM}`;
            this.#musica.volume = 0.2;
            this.#musica.loop = true;
            this.#musica.play();
        };
        this.#musica.play();
    }

    #somBateAsas() {
        const a = new Audio();
        a.src = `${SOM}/piu${randomInt(1, 4)}.${SOM}`;
        a.play();
    }

    #somMorreu() {
        this.#musica?.pause();
        this.#musica = new Audio();
        this.#musica.src = `${SOM}/plaft${randomInt(1, 4)}.${SOM}`;
        this.#musica.onended = () => {
            this.#musica = new Audio();
            this.#musica.src = `${SOM}/grito${randomInt(1, 6)}.${SOM}`;
            this.#musica.play();
        };
        this.#musica.play();
    }

    #somGanhou() {
        this.#musica?.pause();
        this.#musica = new Audio();
        this.#musica.src = `${SOM}/voarvoar.${SOM}`;
        this.#musica.play();
    }

    recomecar(fase) {
        const mundo = new Mundo(fase, this.#fundos, this.#callbacks);
        this.#mundo = mundo;
    }

    #desenhar() {
        const ctx = this.#canvas.getContext("2d", { alpha: false });
        this.#mundo.desenhar(ctx);
    }
}

const flappy = new FlappyBird("flappy");