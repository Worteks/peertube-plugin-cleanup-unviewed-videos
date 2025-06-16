# Cleanup Unviewed Videos

Select videos for deletion according to their last view date.

When the plugin is installed it will add a "Cleanup" => "Unseen Videos" in main
menu.

Default configuration of the plugin disables deletion. The plugin will fake the
deletion process but nothing will be done.

Deletion can be enabled from the plugin settings.

## Release Notes

### 1.1.0

- fix: menu entry position above quick access entries
- fix: menu layout is broken in peertube 7.x

### 1.0.0

- fix: UI doesn't match the application identity
- fix: date display doesn't respect user locale
- fix: menu item is visible whatever the user profile

### 0.2.0

- huge refactoring
- UI layout

### 0.1.1

- support number of months
- minimal support of french language

### 0.1.0

- support for actual deletion
- collect public, private, instance and un-listed videos
  note : no choice is possible.

### Pre-Alpha

- TEST only : WARNING using DAYS instead YEARS
- minimal GUI : vanilla javascript
- collect video to delete but don't delete them
- collect only public videos ( neither private, instance or un-listed )
- does not honor 'deletion' checkbox in plugin settings
- fully client side, use basic server api

## Sponsors

Initial codebase was developed with the financial support of the Direction
générale de l'administration et de la fonction publique (DGAFP) for the
Ministère de l'Action publique, de la Fonction publique et de la Simplification
(french ministry of public service) in the context of the Mentor initiative.
