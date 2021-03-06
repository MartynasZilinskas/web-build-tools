// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as os from 'os';

import {
  IApiClass,
  IApiEnum,
  IApiEnumMember,
  IApiFunction,
  IApiInterface,
  IApiPackage,
  ApiMember,
  IApiProperty,
  ApiItem,
  IApiParameter,
  IApiMethod,
  IMarkupPage,
  IMarkupTable,
  MarkupBasicElement,
  MarkupStructuredElement
} from '@microsoft/api-extractor';

import { ApiJsonFile } from './ApiJsonFile';
import { BasePageRenderer } from './BasePageRenderer';
import { RenderingHelpers } from './RenderingHelpers';
import { MarkupBuilder } from './MarkupBuilder';
import { DocumentationNode } from './DocumentationNode';

/**
 * This is the main engine that reads *.api.json input files and generates IMarkupPage data structures,
 * which are then rendered using an BasePageRenderer subclass.
 */
export class Documenter {
  private readonly _apiJsonFiles: ApiJsonFile[] = [];

  public loadApiJsonFile(apiJsonFilePath: string): void {
    this._apiJsonFiles.push(ApiJsonFile.loadFromFile(apiJsonFilePath));
  }

  public writeDocs(renderer: BasePageRenderer): void {
    console.log(os.EOL + `Deleting old *${renderer.outputFileExtension} files...` + os.EOL);
    renderer.deleteOutputFiles();

    for (const apiJsonFile of this._apiJsonFiles) {
      this._writePackagePage(apiJsonFile, renderer);
    }
  }

  /**
   * GENERATE PAGE: PACKAGE
   */
  private _writePackagePage(apiJsonFile: ApiJsonFile, renderer: BasePageRenderer): void {
    console.log(`Writing ${apiJsonFile.packageName} package`);

    const unscopedPackageName: string = RenderingHelpers.getUnscopedPackageName(apiJsonFile.packageName);

    const docPackage: IApiPackage = apiJsonFile.docPackage;

    const packageNode: DocumentationNode = new DocumentationNode(docPackage, unscopedPackageName, undefined);

    const markupPage: IMarkupPage = MarkupBuilder.createPage(`${unscopedPackageName} package`, packageNode.docId);
    this._writeBreadcrumb(markupPage, packageNode);

    markupPage.elements.push(...MarkupBuilder.renderDocElements(apiJsonFile.docPackage.summary));

    const classesTable: IMarkupTable = MarkupBuilder.createTable([
      MarkupBuilder.createTextElements('Class'),
      MarkupBuilder.createTextElements('Description')
    ]);

    const interfacesTable: IMarkupTable = MarkupBuilder.createTable([
      MarkupBuilder.createTextElements('Interface'),
      MarkupBuilder.createTextElements('Description')
    ]);

    const functionsTable: IMarkupTable = MarkupBuilder.createTable([
      MarkupBuilder.createTextElements('Function'),
      MarkupBuilder.createTextElements('Returns'),
      MarkupBuilder.createTextElements('Description')
    ]);

    const enumerationsTable: IMarkupTable = MarkupBuilder.createTable([
      MarkupBuilder.createTextElements('Enumeration'),
      MarkupBuilder.createTextElements('Description')
    ]);

    for (const exportName of Object.keys(docPackage.exports)) {
      const docItem: ApiItem = docPackage.exports[exportName];

      const exportNode: DocumentationNode = new DocumentationNode(docItem, exportName, packageNode);

      const docItemTitle: MarkupBasicElement[] = [
        MarkupBuilder.createApiLink(
          [ MarkupBuilder.createCode(exportName, 'javascript') ],
          exportNode.getApiReference())
      ];

      const docItemDescription: MarkupBasicElement[] = [];

      if (docItem.isBeta) {
        docItemDescription.push(...MarkupBuilder.createTextElements('(BETA)', { italics: true, bold: true }));
        docItemDescription.push(...MarkupBuilder.createTextElements(' '));
      }
      docItemDescription.push(...MarkupBuilder.renderDocElements(docItem.summary));

      switch (docItem.kind) {
        case 'class':
          classesTable.rows.push(
            MarkupBuilder.createTableRow([
              docItemTitle,
              docItemDescription
            ])
          );
          this._writeClassPage(docItem, exportNode, renderer);
          break;
        case 'interface':
          interfacesTable.rows.push(
            MarkupBuilder.createTableRow([
              docItemTitle,
              docItemDescription
            ])
          );
          this._writeInterfacePage(docItem, exportNode, renderer);
          break;
        case 'function':
          functionsTable.rows.push(
            MarkupBuilder.createTableRow([
              docItemTitle,
              docItem.returnValue ? [MarkupBuilder.createCode(docItem.returnValue.type, 'javascript')] : [],
              docItemDescription
            ])
          );
          this._writeFunctionPage(docItem, exportNode, renderer);
          break;
        case 'enum':
          enumerationsTable.rows.push(
            MarkupBuilder.createTableRow([
              docItemTitle,
              docItemDescription
            ])
          );
          this._writeEnumPage(docItem, exportNode, renderer);
          break;
      }
    }

    if (docPackage.remarks && docPackage.remarks.length) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Remarks'));
      markupPage.elements.push(...MarkupBuilder.renderDocElements(docPackage.remarks));
    }

    if (classesTable.rows.length > 0) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Classes'));
      markupPage.elements.push(classesTable);
    }

    if (interfacesTable.rows.length > 0) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Interfaces'));
      markupPage.elements.push(interfacesTable);
    }

    if (functionsTable.rows.length > 0) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Functions'));
      markupPage.elements.push(functionsTable);
    }

    if (enumerationsTable.rows.length > 0) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Enumerations'));
      markupPage.elements.push(enumerationsTable);
    }

    renderer.writePage(markupPage);
  }

  /**
   * GENERATE PAGE: CLASS
   */
  private _writeClassPage(docClass: IApiClass, classNode: DocumentationNode, renderer: BasePageRenderer): void {
    const className: string = classNode.name;

    // TODO: Show concise generic parameters with class name
    const markupPage: IMarkupPage = MarkupBuilder.createPage(`${className} class`, classNode.docId);
    this._writeBreadcrumb(markupPage, classNode);

    if (docClass.isBeta) {
      this._writeBetaWarning(markupPage.elements);
    }

    markupPage.elements.push(...MarkupBuilder.renderDocElements(docClass.summary));

    markupPage.elements.push(MarkupBuilder.createHeading1('Constructor'));

    // TODO: pending WBT fix
    markupPage.elements.push(...MarkupBuilder.createTextElements('Constructs a new instance of the '));
    markupPage.elements.push(MarkupBuilder.createCode(className));
    markupPage.elements.push(...MarkupBuilder.createTextElements(' class'));

    const propertiesTable: IMarkupTable = MarkupBuilder.createTable([
      MarkupBuilder.createTextElements('Property'),
      MarkupBuilder.createTextElements('Access Modifier'),
      MarkupBuilder.createTextElements('Type'),
      MarkupBuilder.createTextElements('Description')
    ]);

    const methodsTable: IMarkupTable = MarkupBuilder.createTable([
      MarkupBuilder.createTextElements('Method'),
      MarkupBuilder.createTextElements('Access Modifier'),
      MarkupBuilder.createTextElements('Returns'),
      MarkupBuilder.createTextElements('Description')
    ]);

    for (const memberName of Object.keys(docClass.members)) {
      const member: ApiMember = docClass.members[memberName];
      const memberNode: DocumentationNode = new DocumentationNode(member, memberName, classNode);

      switch (member.kind) {
        case 'property':
          const propertyTitle: MarkupBasicElement[] = [
            MarkupBuilder.createApiLink(
              [MarkupBuilder.createCode(memberName, 'javascript')],
              memberNode.getApiReference())
          ];

          propertiesTable.rows.push(
            MarkupBuilder.createTableRow([
              propertyTitle,
              [],
              [MarkupBuilder.createCode(member.type, 'javascript')],
              MarkupBuilder.renderDocElements(member.summary)
            ])
          );
          this._writePropertyPage(member, memberNode, renderer);
          break;

        case 'method':
          const methodTitle: MarkupBasicElement[] = [
            MarkupBuilder.createApiLink(
              [MarkupBuilder.createCode(RenderingHelpers.getConciseSignature(memberName, member), 'javascript')],
              memberNode.getApiReference())
          ];

          methodsTable.rows.push(
            MarkupBuilder.createTableRow([
              methodTitle,
              member.accessModifier ? [MarkupBuilder.createCode(member.accessModifier.toString(), 'javascript')] : [],
              member.returnValue ? [MarkupBuilder.createCode(member.returnValue.type, 'javascript')] : [],
              MarkupBuilder.renderDocElements(member.summary)
            ])
          );
          this._writeMethodPage(member, memberNode, renderer);
          break;
      }
    }

    if (propertiesTable.rows.length > 0) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Properties'));
      markupPage.elements.push(propertiesTable);
    }

    if (methodsTable.rows.length > 0) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Methods'));
      markupPage.elements.push(methodsTable);
    }

    if (docClass.remarks && docClass.remarks.length) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Remarks'));
      markupPage.elements.push(...MarkupBuilder.renderDocElements(docClass.remarks));
    }

    renderer.writePage(markupPage);
  }

  /**
   * GENERATE PAGE: INTERFACE
   */
  private _writeInterfacePage(docInterface: IApiInterface, interfaceNode: DocumentationNode,
    renderer: BasePageRenderer): void {

    const interfaceName: string = interfaceNode.name;

    // TODO: Show concise generic parameters with class name
    const markupPage: IMarkupPage = MarkupBuilder.createPage(`${interfaceName} interface`, interfaceNode.docId);
    this._writeBreadcrumb(markupPage, interfaceNode);

    if (docInterface.isBeta) {
      this._writeBetaWarning(markupPage.elements);
    }

    markupPage.elements.push(...MarkupBuilder.renderDocElements(docInterface.summary));

    const propertiesTable: IMarkupTable = MarkupBuilder.createTable([
      MarkupBuilder.createTextElements('Property'),
      MarkupBuilder.createTextElements('Type'),
      MarkupBuilder.createTextElements('Description')
    ]);

    const methodsTable: IMarkupTable = MarkupBuilder.createTable([
      MarkupBuilder.createTextElements('Method'),
      MarkupBuilder.createTextElements('Returns'),
      MarkupBuilder.createTextElements('Description')
    ]);

    for (const memberName of Object.keys(docInterface.members)) {
      const member: ApiMember = docInterface.members[memberName];
      const memberNode: DocumentationNode = new DocumentationNode(member, memberName, interfaceNode);

      switch (member.kind) {
        case 'property':
          const propertyTitle: MarkupBasicElement[] = [
            MarkupBuilder.createApiLink(
              [MarkupBuilder.createCode(memberName, 'javascript')],
              memberNode.getApiReference())
          ];

          propertiesTable.rows.push(
            MarkupBuilder.createTableRow([
              propertyTitle,
              [MarkupBuilder.createCode(member.type)],
              MarkupBuilder.renderDocElements(member.summary)
            ])
          );
          this._writePropertyPage(member, memberNode, renderer);
          break;

        case 'method':
          const methodTitle: MarkupBasicElement[] = [
            MarkupBuilder.createApiLink(
              [MarkupBuilder.createCode(RenderingHelpers.getConciseSignature(memberName, member), 'javascript')],
              memberNode.getApiReference())
          ];

          methodsTable.rows.push(
            MarkupBuilder.createTableRow([
              methodTitle,
              member.returnValue ? [MarkupBuilder.createCode(member.returnValue.type, 'javascript')] : [],
              MarkupBuilder.renderDocElements(member.summary)
            ])
          );
          this._writeMethodPage(member, memberNode, renderer);
          break;
      }
    }

    if (propertiesTable.rows.length > 0) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Properties'));
      markupPage.elements.push(propertiesTable);
    }

    if (methodsTable.rows.length > 0) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Methods'));
      markupPage.elements.push(methodsTable);
    }

    if (docInterface.remarks && docInterface.remarks.length) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Remarks'));
      markupPage.elements.push(...MarkupBuilder.renderDocElements(docInterface.remarks));
    }

    renderer.writePage(markupPage);
  }

  /**
   * GENERATE PAGE: ENUM
   */
  private _writeEnumPage(docEnum: IApiEnum, enumNode: DocumentationNode,
    renderer: BasePageRenderer): void {

    const enumName: string = enumNode.name;

    // TODO: Show concise generic parameters with class name
    const markupPage: IMarkupPage = MarkupBuilder.createPage(`${enumName} enumeration`, enumNode.docId);
    this._writeBreadcrumb(markupPage, enumNode);

    if (docEnum.isBeta) {
      this._writeBetaWarning(markupPage.elements);
    }

    markupPage.elements.push(...MarkupBuilder.renderDocElements(docEnum.summary));

    const membersTable: IMarkupTable = MarkupBuilder.createTable([
      MarkupBuilder.createTextElements('Member'),
      MarkupBuilder.createTextElements('Value'),
      MarkupBuilder.createTextElements('Description')
    ]);

    for (const memberName of Object.keys(docEnum.values)) {
      const member: IApiEnumMember = (docEnum.values as any)[memberName]; // tslint:disable-line:no-any

      const enumValue: MarkupBasicElement[] = [];

      if (member.value) {
        enumValue.push(MarkupBuilder.createCode('= ' + member.value));
      }

      membersTable.rows.push(
        MarkupBuilder.createTableRow([
          MarkupBuilder.createTextElements(memberName),
          enumValue,
          MarkupBuilder.renderDocElements(member.summary)
        ])
      );
    }

    if (membersTable.rows.length > 0) {
      markupPage.elements.push(membersTable);
    }

    renderer.writePage(markupPage);
  }

  /**
   * GENERATE PAGE: PROPERTY
   */
  private _writePropertyPage(docProperty: IApiProperty, propertyNode: DocumentationNode,
    renderer: BasePageRenderer): void {

    const fullProperyName: string = propertyNode.parent!.name + '.' + propertyNode.name;

    const markupPage: IMarkupPage = MarkupBuilder.createPage(`${fullProperyName} property`, propertyNode.docId);
    this._writeBreadcrumb(markupPage, propertyNode);

    if (docProperty.isBeta) {
      this._writeBetaWarning(markupPage.elements);
    }

    markupPage.elements.push(...MarkupBuilder.renderDocElements(docProperty.summary));

    markupPage.elements.push(MarkupBuilder.PARAGRAPH);
    markupPage.elements.push(...MarkupBuilder.createTextElements('Signature:', { bold: true }));
    markupPage.elements.push(MarkupBuilder.createCodeBox(propertyNode.name + ': ' + docProperty.type, 'javascript'));

    if (docProperty.remarks && docProperty.remarks.length) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Remarks'));
      markupPage.elements.push(...MarkupBuilder.renderDocElements(docProperty.remarks));
    }

    renderer.writePage(markupPage);
  }

  /**
   * GENERATE PAGE: METHOD
   */
  private _writeMethodPage(docMethod: IApiMethod, methodNode: DocumentationNode, renderer: BasePageRenderer): void {

    const fullMethodName: string = methodNode.parent!.name + '.' + methodNode.name;

    const markupPage: IMarkupPage = MarkupBuilder.createPage(`${fullMethodName} method`, methodNode.docId);
    this._writeBreadcrumb(markupPage, methodNode);

    if (docMethod.isBeta) {
      this._writeBetaWarning(markupPage.elements);
    }

    markupPage.elements.push(...MarkupBuilder.renderDocElements(docMethod.summary));

    markupPage.elements.push(MarkupBuilder.PARAGRAPH);
    markupPage.elements.push(...MarkupBuilder.createTextElements('Signature:', { bold: true }));
    markupPage.elements.push(MarkupBuilder.createCodeBox(docMethod.signature, 'javascript'));

    if (docMethod.returnValue) {
      markupPage.elements.push(...MarkupBuilder.createTextElements('Returns:', { bold: true }));
      markupPage.elements.push(...MarkupBuilder.createTextElements(' '));
      markupPage.elements.push(MarkupBuilder.createCode(docMethod.returnValue.type, 'javascript'));
      markupPage.elements.push(MarkupBuilder.PARAGRAPH);
      markupPage.elements.push(...MarkupBuilder.renderDocElements(docMethod.returnValue.description));
    }

    if (docMethod.remarks && docMethod.remarks.length) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Remarks'));
      markupPage.elements.push(...MarkupBuilder.renderDocElements(docMethod.remarks));
    }

    if (Object.keys(docMethod.parameters).length > 0) {
      const parametersTable: IMarkupTable = MarkupBuilder.createTable([
        MarkupBuilder.createTextElements('Parameter'),
        MarkupBuilder.createTextElements('Type'),
        MarkupBuilder.createTextElements('Description')
      ]);

      markupPage.elements.push(MarkupBuilder.createHeading1('Parameters'));
      markupPage.elements.push(parametersTable);
      for (const parameterName of Object.keys(docMethod.parameters)) {
        const parameter: IApiParameter = docMethod.parameters[parameterName];
          parametersTable.rows.push(MarkupBuilder.createTableRow([
            [MarkupBuilder.createCode(parameterName, 'javascript')],
            parameter.type ? [MarkupBuilder.createCode(parameter.type, 'javascript')] : [],
            MarkupBuilder.renderDocElements(parameter.description)
          ])
        );
      }
    }

    renderer.writePage(markupPage);
  }

  /**
   * GENERATE PAGE: FUNCTION
   */
  private _writeFunctionPage(docFunction: IApiFunction, functionNode: DocumentationNode,
    renderer: BasePageRenderer): void {

    const markupPage: IMarkupPage = MarkupBuilder.createPage(`${functionNode.name} function`, functionNode.docId);
    this._writeBreadcrumb(markupPage, functionNode);

    if (docFunction.isBeta) {
      this._writeBetaWarning(markupPage.elements);
    }

    markupPage.elements.push(...MarkupBuilder.renderDocElements(docFunction.summary));

    markupPage.elements.push(MarkupBuilder.PARAGRAPH);
    markupPage.elements.push(...MarkupBuilder.createTextElements('Signature:', { bold: true }));
    markupPage.elements.push(MarkupBuilder.createCodeBox(functionNode.name, 'javascript'));

    if (docFunction.returnValue) {
      markupPage.elements.push(...MarkupBuilder.createTextElements('Returns:', { bold: true }));
      markupPage.elements.push(...MarkupBuilder.createTextElements(' '));
      markupPage.elements.push(MarkupBuilder.createCode(docFunction.returnValue.type, 'javascript'));
      markupPage.elements.push(MarkupBuilder.PARAGRAPH);
      markupPage.elements.push(...MarkupBuilder.renderDocElements(docFunction.returnValue.description));
    }

    if (docFunction.remarks && docFunction.remarks.length) {
      markupPage.elements.push(MarkupBuilder.createHeading1('Remarks'));
      markupPage.elements.push(...MarkupBuilder.renderDocElements(docFunction.remarks));
    }

    if (Object.keys(docFunction.parameters).length > 0) {
      const parametersTable: IMarkupTable = MarkupBuilder.createTable([
        MarkupBuilder.createTextElements('Parameter'),
        MarkupBuilder.createTextElements('Type'),
        MarkupBuilder.createTextElements('Description')
      ]);

      markupPage.elements.push(MarkupBuilder.createHeading1('Parameters'));
      markupPage.elements.push(parametersTable);
      for (const parameterName of Object.keys(docFunction.parameters)) {
        const parameter: IApiParameter = docFunction.parameters[parameterName];
          parametersTable.rows.push(MarkupBuilder.createTableRow([
            [MarkupBuilder.createCode(parameterName, 'javascript')],
            parameter.type ? [MarkupBuilder.createCode(parameter.type, 'javascript')] : [],
            MarkupBuilder.renderDocElements(parameter.description)
          ])
        );
      }
    }

    renderer.writePage(markupPage);
  }

  private _writeBreadcrumb(markupPage: IMarkupPage, currentNode: DocumentationNode): void {
    markupPage.breadcrumb.push(MarkupBuilder.createWebLinkFromText('Home', './index'));

    const reversedNodes: DocumentationNode[] = [];
    for (let node: DocumentationNode|undefined = currentNode.parent; node; node = node.parent) {
      reversedNodes.unshift(node);
    }
    for (const node of reversedNodes) {
      markupPage.breadcrumb.push(...MarkupBuilder.createTextElements(' > '));
      markupPage.breadcrumb.push(MarkupBuilder.createApiLinkFromText(node.name, node.getApiReference()));
    }
  }

  private _writeBetaWarning(elements: MarkupStructuredElement[]): void {
    const betaWarning: string = 'This API is provided as a preview for developers and may change'
      + ' based on feedback that we receive.  Do not use this API in a production environment.';
    elements.push(
      MarkupBuilder.createNoteBoxFromText(betaWarning)
    );
  }

}
