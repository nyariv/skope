# ScopeJS

A sandboxed, html-only, UI framework. The main goal of this library is to allow user generated content to use javascript in html safely. The idea behind this is if this is safe enough for user generated content, then it is also safe for any other possible usecases.

Having sandboxed js-in-html enables creating interactive html without permitting the use of all of the browsers's api, which would be dangerous if in the wrong hands. To use native browser api wrapper, functions should be provided to the app that use them, this would allow the app developer to sanitize and whitelist parameters to be used with the sensitive api.

The sanbox library does not use `eval` / `Function` under the hood, and therefore makes this library [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) friendly.

This allows, for example, content platforms (such as WordPress, Drupal, or any other blog platforms), to allow their users to embed dynamic elements in their content without having to worry about security.

This library makes html in REST api safe again!

## Installation

```
npm install @nyariv/scopejs
```

## Getting started

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script deferred src="https://cdn.jsdelivr.net/gh/nyariv/scope-js@latest/dist/defaultInit.js" type="module"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/nyariv/scope-js@latest/dist/scopejs.css">
  <meta charset="UTF-8">
</head>
  <body x-app x-cloak $my-var="'Hello World'">
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
  <button $on="false" @click="on = !on">{{on ? 'On' : 'Off'}}</button>
```

Trigger only once

```html
  <button $on="false" @click.once="on = !on">{{on ? 'On' : 'Off'}}</button>
```

### Attributes

```html
  <style>
    .red {color: red}
  </style>
  <div :class="{red: true}">this is red</div>
```

### x-for

```html
  <div> <span x-for="i in [1,2,3]"> {{i}} </span> </div
```

### x-if

```html
  <div $on="false">
    <button @click="on = !on">{{on ? 'On' : 'Off'}}</button>
    <div x-if="on"> Hello World </div>
  </div>
```

### x-show

```html
  <div $on="false">
    <button @click="on = !on">{{on ? 'On' : 'Off'}}</button>
    <div x-show="on"> Hello World </div>
  </div>
```

### x-model

```html
  <div $value="false">
    <label>Say hi <input type="checkbox" x-model="value"></label>
    <div x-show="value"> Hello World </div>
  </div>
```

### x-text

```html
  <div $text="'Hello World'">
    <label>Input <input type="text" x-model="text"></label>
    <div x-text="text"></div>
  </div>
```
### x-html

```html
  <div $html="'&lt;i&gt;Hello World&lt;/i&gt;'">
    <label>Input <input type="text" x-model="html"></label>
    <div x-html="html"></div>
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
