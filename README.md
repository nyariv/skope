# Skope.js

A sandboxed js-in-html UI framework. The main goal of this library is to allow user generated content to use javascript in html safely. The idea behind this is if this is safe enough for user generated content, then it is also safe for any other possible usecases.

Having sandboxed js-in-html enables creating interactive html without permitting the use of all of the browsers's api, which would be dangerous if in the wrong hands. To use native browser api, wrapper functions should be provided to the app that use them, this would allow the app developer to sanitize and whitelist parameters to be used with the sensitive api.

The sandbox library does not use `eval` / `Function` under the hood, and therefore makes this library [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) friendly.

This allows, for example, content platforms (such as WordPress, Drupal, or any other CMS) to allow their users to embed dynamic elements in their content without having to worry about security.

This library makes html in REST api safe again!

## Installation

```
npm i skope
```

## Getting started

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.jsdelivr.net/gh/nyariv/skope@latest/dist/defaultInit.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/nyariv/skope@latest/dist/skopejs.css">
  <meta charset="UTF-8">
</head>
  <body skope s-cloak $my-var="'Hello World'">
    {{myVar}}
  </body>
</html>
```

## Features
### Variables

```html
  <div $var1="'Hello'" $var2="'World'">
    {{var1}} {{var2}}
  </div>
```

### Events

Trigger multiple times

```html
  <button $var1="false" @click="var1 = !var1">{{var1 ? 'On' : 'Off'}}</button>
```

Trigger only once

```html
  <button $var1="false" @click.once="var1 = !var1">{{var1 ? 'On' : 'Off'}}</button>
```

Trigger throttled

```html
  <button $counter="0" @click.throttle(700)="++counter">Throttled count: {{counter}}</button>
```

Throttle until complete

```html
  <button $counter="0" @click.throttle="await $delay(700); ++counter">Throttle until complete: {{counter}}</button>
```

Trigger debounced

```html
  <button $counter="0" @click.debounce(700)="++counter">Debounced count: {{counter}}</button>
```

Queued callbacks

```html
  <button $counter="0" @click.queue="await $delay(700); ++counter">Queue count: {{counter}}</button>
```

Save event callback promise to variable

```html
  <button $var1="'none'" @click$var1="return Math.random()">Event value: {{var1}}</button>
```

### Attributes

```html
  <style>
    .red {color: red}
  </style>
  <div :class="{red: true}">this is red</div>
```

### Inline IFrames

Iframes without a src or srcdoc are supported, and the body of the iframe is populated with the inner html, like a web component.

IFrames are usuful for when you want to confine the dom and styles within an element.

Styles from outside the iframe are copied into it, so that styles can be defined out side of it, and skope behaves as if everything is within the same document.

```html
  <style>
    .iframe-container {
      width: 200px;
      height: 100px;
    }
    iframe {
      padding: 12px;
      border: 1px solid #aaa;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    .ok {
      color: green;
    }
  </style>
  <div $counter="0" class="iframe-container">
    <iframe>
      <iframe>
        <button @click="++counter" class="ok">Counter: {{counter}}</button>
      </iframe>
    </iframe>
  </div>
```

### Templates and components

It is possible to define template elements that can be reused multiple times as components, which behave like web components.

The ID attribute acts as the name of the component, and can be instantiated using the `s-component` attribute. The template will have a detached scope within the component. Attributes that are defined on the template will be copied and be processed on the component element, while variable attributes will be accessible within the template scope, they act like default values when defined on the template element.

The `slot` attribute can be used as a placeholder for inner html of the component, like it behaves with web components. Only one slot element can be defined. Slot content will be replaced by component content, and the component content scope will continue from the component's parent scope. Template scope is detached.

```html
  <div $counter="0">

    <div s-component="test" $name="'Earth'">Outer counter {{counter}}</div>

    <template id="test" $name="'World'" $counter="0">
      <button @click="++counter">Hello {{name}}: {{counter}}</button>
      <style>
        span {
          color: green;
        }
      </style>
      <span slot></span>
    </template>
  </div>
```

### s-cloak

This attribute is removed when the html is processed by skope. In the default stylesheet it is treated as `display: none`.

```html
  <div s-cloak>
    {{'this is hidden while app is loading'}}
  </div>
```

### s-for

```html
  <div> <span s-for="i in [1,2,3]"> {{i}} </span> </div>
```

```html
  <div s-for="(k, v) in {c: 1, b: 2, a: 3}"> {{k}}: {{v}} </div>
```

### s-if

```html
  <div $var1="false">
    <button @click="var1 = !var1">{{var1 ? 'On' : 'Off'}}</button>
    <div s-if="var1"> Hello World </div>
  </div>
```

### s-show

This attribute adds a class `.hide` if true. In the default stylesheet it is treated as `display: none`.

```html
  <div $var1="false">
    <button @click="var1 = !var1">{{var1 ? 'On' : 'Off'}}</button>
    <div s-show="var1"> Hello World </div>
  </div>
```

### s-transition

This attribute will add classes based on a promise set to a variable, for each of its promise state:

- `.s-transition` - always set for this directive
- `.s-transition-idle` - set when the variable is undefined or is not a promise
- `.s-transition-active` - set when the promise did not resolve or reject yet
- `.s-transition-done` - set when the promise is resolved
- `.s-transition-error` - set when the promise rejected

```html
  <div $var1 $var2>
    <style>
      .s-transition span {
        display: none;
      }
      .s-transition-idle .idle {
        display: block;
      }
      .s-transition-active .active {
        display: block;
      }
      .s-transition-done .done {
        color: green;
        display: block;
      }
      .s-transition-error .error {
        color: red;
        display: block;
      }

      .loader {
        border: 2px solid white;
        border-top: 2px solid #ccc;
        border-radius: 50%;
        width: 14px;
        height: 14px;
        animation: spin .4s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>

    <button @click$var1="await $delay(2000); if(Math.random() < .5) throw new Error('random error')">Trigger transition</button>
    <div s-transition="var1"> 
      <span class="idle">Idle</span>
      <span class="active"><div class="loader"></div></span>
      <span class="done">Done</span>
      <span class="error">Error: {{var1?.catch((e) => e.message)}}</span>
    </div>

    <button @click$var2="await $delay(2000); if(Math.random() < .5) throw new Error('random error')">Trigger custom transition</button>
    <div $running
          class="s-transition"
          :class.s-transition-idle="(running = var2?.then(() => running = false, () => running = false)) === undefined"
          :class.s-transition-active="!!running"
          :class.s-transition-done="!running && var2?.then(() => true, () => false)"
          :class.s-transition-error="!running && var2?.then(() => false, () => true)"
    >
      <span class="idle">Idle</span>
      <span class="active"><div class="loader"></div></span>
      <span class="done">Done</span>
      <span class="error">Error: {{var2?.catch((e) => e.message)}}</span>
    </div>
  </div>
```

### s-model

```html
  <div $value="false">
    <label>Say hi <input type="checkbox" s-model="value"></label>
    <div s-show="value"> Hello World </div>
  </div>
```

### s-text

```html
  <div $text="'Hello World'">
    <label>Input <input type="text" s-model="text"></label>
    <div s-text="text"></div>
  </div>
```
### s-html

```html
  <div $html="'&lt;i&gt;Hello World&lt;/i&gt;'">
    <label>Input <input type="text" s-model="html"></label>
    <div s-html="html"></div>
  </div>
```

### s-ref

This attribute will save the element as a special skope element object in a map of elements and their assigned names in the `$refs` global.

```html
  <div $counter="0">
    <button @click="$refs.counterElem.text(++counter)">Add One</button>
    <div s-ref="counterElem">0</div>
  <div>
```

A skope element can also be a collection of elements which have a single api to act on all of them, similar to jQuery.

```html
  <div $counter="0">
    <button @click="$refs.counterElems.val(++counter)">Add One</button>
    <input type="number" s-ref="counterElems" s-for="i in [0,0,0]">
  <div>
```

### s-detached

Create a scope of html that does not inherit scopes from parent elements, and has it its own `$refs` object.

```html
  <div $one="1">
    <div s-detached>
      {{typeof one === 'undefined' ? 'detached' : 'not detached'}}
    <div>
  <div>
```

### s-static

An element with this attribute will not execute js in its nested elements, and will sanitize the html with safe element types only.

```html
  <div s-static>
    <div $this-is-static="not static">
      {{thisIsStatic}}
    </div>
  </div>
```


## Tenets

The main tenets of this library are ment to guarantee safety of this library, now and in the future, without having to update the library. These tenets are:

1) Only safe ECMAScript features are whitelisted, everything else is either not supported or not allowed by default
2) Only safe HTML5 elements, and elements defined by that app, are whitelisted, all other elements are not allowed by default
3) Safety is guaranteed if a new unsafe ES feature or HTML element are introduced to web browsers because they are not, or cannot be, supported
4) Whitelisted ES defaults will never include anything I/O bound, anything that could cause denial of service with a single expression, or anything that affects session behavior
5) Whitelisted HTML defaults will never include elements that affect session behavior or make network requests (media and anchor tags are the exception).
6) JS in a DOM element will never have more permissions than its parent, and have access only to its child elements, with the exception of app logic that allows this.
