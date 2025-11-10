# Make Split Commits

## Overview

Evaluate what changes has been done within the repository, and commit them. The changes are to be split into multiple commits based on criterias.

## Steps

1. **Explore the Changes**

   - Use `git status -s` to list files that got changed in the working directory, both tracked and untracked, and their statuses. The information of the output is as outlined in the "Git Status Short Format" in the "References" section.
   - If there is any staged file, run `git restore --staged .` to unstage all the changes and redo `git status -s` to get the updated file and status list.
   - Use `git -P diff` to view the diff of all tracked files.
   - For every untracked file creation, use your tool to read the file content.

2. **Evaluate the Changes**

   - Reason through what each of the changes are trying to achieve and how they might be related. If you think you lack contexts due to the truncation in the diff output, use your tool to read more file content.
   - Logically group related changes together based on projects and the modification concerns.

3. **Staging and Committing**

   For each of the changes group:

   - Stage all the relevant files using `git add -v -- [<pathspec>...]`.
   - Commit the changes, conforming to the "Guidelines on Git Commit Messages For This Project".

## References

### Git Status Short Format

the status of each path is shown as one of these forms

XY PATH
XY ORIG_PATH -> PATH

where ORIG_PATH is where the renamed/copied contents came from. ORIG_PATH is only shown when the entry is renamed or copied. The XY is a two-letter status code.

The fields (including the ->) are separated from each other by a single space. If a filename contains whitespace or other nonprintable characters, that field will be quoted in the manner of a C string literal: surrounded by ASCII double quote (34) characters, and with interior special characters backslash-escaped.

When a path is untracked, X and Y are always the same, since they are unknown to the index. ?? is used for untracked paths. Ignored files are not listed unless --ignored is used; if it is, ignored files are indicated by !!.

In the following table, these characters are used for X and Y fields for the first two sections that show tracked paths:
' ' (empty space) = unmodified
M = modified
T = file type changed (regular file, symbolic link or submodule)
A = added
D = deleted
R = renamed
C = copied (if config option status.renames is set to "copies")

| X             | Y         | Meaning                               |
| ------------- | --------- | ------------------------------------- |
| ' '           | A/M/D     | not updated                           |
| M             | ' '/M/T/D | updated in index                      |
| T             | ' '/M/T/D | type changed in index                 |
| A             | ' '/M/T/D | added to index                        |
| D             | ' '       | deleted from index                    |
| R             | ' '/M/T/D | renamed in index                      |
| C             | ' '/M/T/D | copied in index                       |
| M/T/A/R/C     | ' '       | index and work tree matches           |
| ' '/M/T/A/R/C | M         | work tree changed since index         |
| ' '/M/T/A/R/C | T         | type changed in work tree since index |
| ' '/M/T/A/R/C | D         | deleted in work tree                  |
| ' '           | R         | renamed in work tree                  |
| ' '           | C         | copied in work tree                   |
| ?             | ?         | untracked                             |
| !             | !         | ignored                               |
