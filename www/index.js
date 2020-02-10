let value = 0;
let counterId = "counter";
let cachedCounter = null;

function incrementCounter() {
    if(!cachedCounter) {
        cachedCounter = document.getElementById(counterId);
    }

    cachedCounter.innerText = ++value;
}