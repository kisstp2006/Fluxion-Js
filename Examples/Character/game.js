import Engine from "../../Fluxion/Core/Engine.js";
import Sprite from "../../Fluxion/Core/Sprite.js";
import Input from "../../Fluxion/Core/Input.js";

const input = new Input();
const FluxionLogo=["../../Fluxion/Icon/Fluxion_icon.png"];

const game = {
    spriteList: [],

 init(renderer) {
        this.spriteList.push(new Sprite(renderer,FluxionLogo,-0.3 , -0.5, 0.55, 1));
        console.log("Game started");
    },
    update(deltaTime) {
        console.log("Game running: "+deltaTime);
        //Move with the icons
        if(input.getKey("w")){
            this.spriteList[0].y+=1*deltaTime;
        }
        if(input.getKey("a")){
            this.spriteList[0].x-=1*deltaTime;

        }
        if(input.getKey("s")){
            this.spriteList[0].y-=1*deltaTime;
        }
        if(input.getKey("d")){
            this.spriteList[0].x+=1*deltaTime;
        }
        if(this.camera.zoom >1){
            this.camera.zoom-=10*deltaTime;
            console.log("Zooming out");
        }
        if(input.getMouseButton(0)){
            this.camera.zoom=1.5;
            console.log("Zoomed");
        }
    },
    draw(renderer) {
        renderer.clear();
        this.spriteList.forEach(sprite => sprite.draw());
    }
}
window.onload = async () => {
    // Start the game
    new Engine("gameCanvas", game);
};