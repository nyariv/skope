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
  <script src="https://cdn.jsdelivr.net/gh/nyariv/skope@latest/dist/defaultInit.js" type="module"></script>
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

Save event callback promise to variable

```html
  <div $var1="0">
    <button  @click$var1="await $delay(500); return Math.random()">{{'event value: ' + await var1}}</button>
  </div>
```

### Attributes

```html
  <style>
    .red {color: red}
  </style>
  <div :class="{red: true}">this is red</div>
```

### s-cloak

This attribute is removed when the html is processed by skope. In the default stylesheet it is treated as `display: none`.

```html
  <div s-clock>
    {{'this is hidden while app is loading'}}
  </div>
```

### s-for

```html
  <div> <span s-for="i in [1,2,3]"> {{i}} </span> </div
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
- `.s-transition.error` - set when the promise rejected

```html
  <div $var1>
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
        border: 2px solid white; /* Light grey */
        border-top: 2px solid #ccc; /* Blue */
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
    <button @click$var1="await $delay(2000); if(Math.random() < .5) throw new Error('error')">Trigger transition</button>
    <div s-transition="var1"> 
      <span class="idle">Idle</span>
      <span class="active"><div class="loader"></div></span>
      <span class="done">Done</span>
      <span class="error">Error</span>
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
    <div $one="1">
      {{typeof one === 'undefined' ? 'detached' : 'not detached'}}
    <div>
  <div>
```


## Tenets

The main tenets of this library are ment to guarantee safety of this library, now and in the future, without having to update the library. These tenets are:

1) Only safe ECMAScript features are whitelisted, everything else is either not supported or not allowed by default
2) Only safe HTML5 elements, and elements defined by that app, are whitelisted, all other elements are not allowed by default
3) Safety is guaranteed if a new unsafe ES feature or HTML element are introduced to web browsers because they are not, or cannot be, supported
4) Whitelisted ES defaults will never include anything I/O bound, anything that could cause denial of service with a single expression, or anything that affects session behavior
5) Whitelisted HTML defaults will never include elements that affect session behavior or make network requests (media and anchor tags are the exception).
6) JS in a DOM element will never have more permissions than its parent, and have access only to its child elements, with the exception of app logic that allows this.
