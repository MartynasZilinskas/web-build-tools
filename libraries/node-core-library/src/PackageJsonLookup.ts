// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

/* tslint:disable:no-constant-condition */

import * as fsx from 'fs-extra';
import * as path from 'path';
import { JsonFile } from './JsonFile';

/**
 * Represents a package.json file.
 */
interface IPackageJson {
  name: string;
}

/**
 * This class provides methods for finding the nearest "package.json" for a folder
 * and retrieving the name of the package.  The results are cached.
 *
 * @public
 */
export class PackageJsonLookup {
  // Cached the return values for tryGetPackageFolder():
  // sourceFilePath --> packageJsonFolder
  private _packageFolderCache: Map<string, string | undefined>;

  // Cached the return values for getPackageName():
  // packageJsonPath --> packageName
  private _packageNameCache: Map<string, string>;

  constructor() {
    this.clearCache();
  }

  /**
   * Clears the internal file cache.
   * @remarks
   * Call this method if changes have been made to the package.json files on disk.
   */
  public clearCache(): void {
    this._packageFolderCache = new Map<string, string | undefined>();
    this._packageNameCache = new Map<string, string>();
  }

  /**
   * Finds the path to the package folder of a given currentPath, by probing
   * upwards from the currentPath until a package.json file is found.
   * If no package.json can be found, undefined is returned.
   *
   * @param currentPath - a path (relative or absolute) of the current location
   * @returns a relative path to the package folder
   */
  public tryGetPackageFolder(sourceFilePath: string): string | undefined {
    // Two lookups are required, because get() cannot distinguish the undefined value
    // versus a missing key.
    if (this._packageFolderCache.has(sourceFilePath)) {
      return this._packageFolderCache.get(sourceFilePath);
    }

    let result: string | undefined;

    const parentFolder: string = path.dirname(sourceFilePath);
    if (!parentFolder || parentFolder === sourceFilePath) {
      result = undefined;
    } else if (fsx.existsSync(path.join(parentFolder, 'package.json'))) {
      result = path.normalize(parentFolder);
    } else {
      result = this.tryGetPackageFolder(parentFolder);
    }

    this._packageFolderCache.set(sourceFilePath, result);
    return result;
  }

  /**
   * Loads the package.json file and returns the name of the package.
   *
   * @param packageJsonPath - an absolute path to the folder containing the
   * package.json file, it does not include the 'package.json' suffix.
   * @returns the name of the package (E.g. @microsoft/api-extractor)
   */
  public getPackageName(packageJsonPath: string): string {
    let result: string | undefined = this._packageNameCache.get(packageJsonPath);
    if (result !== undefined) {
      return result;
    }

    const packageJson: IPackageJson = JsonFile.load(path.join(packageJsonPath, 'package.json')) as IPackageJson;
    result = packageJson.name;

    this._packageNameCache.set(packageJsonPath, result);
    return result;
  }
}
