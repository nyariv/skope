# ScopeJS

A sandboxed declarative front-end framework. The main goal of this library is to allow user generated content to use javascript in html safely. The idea behind this is if this is safe enough for user generated content, then it is also safe for any other possible use.

This would allow, for example, content platforms (such as WordPress, Drupal, or any other blog platforms), to allow their users to embed dynamic elements in their content without having to worry about security.

## Tenets

The main tenets of this library are ment to guarantee safety of this library, now and in the future, without having to update the library. These tenets are:

1) Only safe ECMAScript features are whitelisted, everything else is either not supported or not allowed by default
2) Only safe HTML5 elements, and elements defined by that app, are whitelisted, all other elements are not allowed by default
3) Safety is guaranteed if a new unsafe ES feature or HTML element are introduced to web browsers because they are not, or cannot be, supported
4) Whitelisted ES defaults will never include anything I/O bound, anything that could cause denial of service with a single expression, or anything that affects session behavior
5) Whitelisted HTML defaults will never include elements that affect session behavior or make network requests (media and anchor tags are the exception).
6) JS in a DOM element will never have more permissions than its parent, and have access only to its child elements, with the exception of app logic that allows this.