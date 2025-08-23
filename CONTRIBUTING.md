# Contributing to LLM Agent POC

First off, thank you for considering contributing to LLM Agent POC! It's people like you that make such a project great.

## Where do I go from here?

If you've noticed a bug or have a feature request, [make one](https://github.com/PythonicVarun/LLM-Agent-POC/issues/new)! It's generally best if you get confirmation of your bug or approval for your feature request this way before starting to code.

### Fork & create a branch

If this is something you think you can fix, then fork LLM Agent POC and create a branch with a descriptive name.

A good branch name would be (where issue #33 is the ticket you're working on):

```sh
git checkout -b 33-add-amazing-feature
```

### Get the test suite running

Make sure you can get the test suite running on your local machine.

```sh
npm test
```

### Implement your fix or feature

At this point, you're ready to make your changes! Feel free to ask for help; everyone is a beginner at first 😸

### Make a Pull Request

At this point, you should switch back to your master branch and make sure it's up to date with LLM Agent POC's master branch:

```sh
git remote add upstream git@github.com:PythonicVarun/LLM-Agent-POC.git
git checkout master
git pull upstream master
```

Then update your feature branch from your local copy of master, and push it!

```sh
git checkout 33-add-amazing-feature
git rebase master
git push --force-with-lease origin 33-add-amazing-feature
```

Finally, go to GitHub and make a Pull Request.

### Keeping your Pull Request updated

If a maintainer asks you to "rebase" your PR, they're saying that a lot of code has changed, and that you need to update your branch so it's easier to merge.

To learn more about rebasing and merging, check out this guide on [merging vs. rebasing](https://www.atlassian.com/git/tutorials/merging-vs-rebasing).

## How to get in touch

If you need help, you can contact the author, Varun Agnihotri, at code@pythonicvarun.me.

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for more information.
