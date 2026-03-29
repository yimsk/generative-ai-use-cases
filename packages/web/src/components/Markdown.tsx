import React, { useEffect, useMemo, useState, memo } from 'react';
import { BaseProps } from '../@types/common';
import { default as ReactMarkdown } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import ButtonCopy from './ButtonCopy';
import useRagFile from '../hooks/useRagFile';
import { PiSpinnerGap } from 'react-icons/pi';
import useFileApi from '../hooks/useFileApi';
import 'katex/dist/katex.min.css';

import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MermaidWithToggle } from './Mermaid/MermaidWithToggle';
import { SvgWithToggle } from './Svg/SvgWithToggle';
import { ChartWithToggle } from './Chart/ChartWithToggle';
import { useLocation } from 'react-router-dom';

export { MermaidWithToggle };

// -- Typed renderer props --

interface LinkRendererProps {
  href?: string;
  id?: string;
  children?: React.ReactNode;
}

interface ImageRendererProps {
  src?: string;
  id?: string;
}

interface PreRendererProps {
  children?: React.ReactNode;
}

interface CodeRendererProps {
  className?: string;
  children?: React.ReactNode;
}

// -- Syntax highlighting registration --

import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql';
import ini from 'react-syntax-highlighter/dist/esm/languages/prism/ini';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import perl from 'react-syntax-highlighter/dist/esm/languages/prism/perl';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import xmlDoc from 'react-syntax-highlighter/dist/esm/languages/prism/xml-doc';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';

const registerSyntaxLanguages = () => {
  const languages: [
    string,
    Parameters<typeof SyntaxHighlighter.registerLanguage>[1],
  ][] = [
    ['bash', bash],
    ['c', c],
    ['cpp', cpp],
    ['csharp', csharp],
    ['css', css],
    ['diff', diff],
    ['go', go],
    ['graphql', graphql],
    ['ini', ini],
    ['java', java],
    ['javascript', javascript],
    ['json', json],
    ['jsx', jsx],
    ['markdown', markdown],
    ['perl', perl],
    ['php', php],
    ['python', python],
    ['sql', sql],
    ['typescript', typescript],
    ['tsx', tsx],
    ['xml-doc', xmlDoc],
    ['yaml', yaml],
  ];
  languages.forEach(([name, lang]) =>
    SyntaxHighlighter.registerLanguage(name, lang)
  );
};

registerSyntaxLanguages();

// -- SVG detection helper (pure) --

const isSvgCode = (code: string): boolean => {
  const trimmed = code.trim();
  return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml');
};

// -- S3 / file resolution renderers --

const LinkRenderer: React.FC<LinkRendererProps> = ({ href, id, children }) => {
  const { downloadDoc, isS3Url, downloading } = useRagFile();
  const isS3 = useMemo(() => isS3Url(href ?? ''), [isS3Url, href]);

  const location = useLocation();
  const isKnowledgeBase = useMemo(
    () => location.pathname.includes('/rag-knowledge-base'),
    [location.pathname]
  );

  if (isS3) {
    return (
      <a
        id={id}
        onClick={() => {
          if (!downloading) {
            downloadDoc(href!, isKnowledgeBase ? 'knowledgeBase' : 'default');
          }
        }}
        className={`cursor-pointer ${downloading ? 'text-gray-400' : ''}`}>
        {children}
        {downloading && (
          <PiSpinnerGap className="mx-2 inline-block animate-spin" />
        )}
      </a>
    );
  }

  return (
    <a
      id={id}
      href={href}
      target={href?.startsWith('#') ? '_self' : '_blank'}
      rel="noreferrer">
      {children}
    </a>
  );
};

const ImageRenderer: React.FC<ImageRendererProps> = ({ src, id }) => {
  const { isS3Url } = useRagFile();
  const { getFileDownloadSignedUrl } = useFileApi();
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    if (isS3Url(src ?? '')) {
      getFileDownloadSignedUrl(src!).then((url) => setResolvedSrc(url));
    }
  }, [getFileDownloadSignedUrl, isS3Url, src]);

  return <img id={id} src={resolvedSrc} />;
};

// -- Diagram / special-case renderers --

const PreRenderer: React.FC<PreRendererProps> = ({ children }) => {
  if (React.isValidElement(children)) {
    const childProps = children.props as {
      className?: string;
      children?: string;
    };
    const className = childProps?.className || '';
    const codeContent = String(childProps?.children || '').trim();

    if (className.includes('language-mermaid')) {
      return <>{children}</>;
    }
    if (className.includes('language-chart')) {
      return <>{children}</>;
    }
    if (
      className.includes('language-svg') ||
      ((className.includes('language-xml') ||
        className.includes('language-html')) &&
        (codeContent.startsWith('<svg') || codeContent.startsWith('<?xml')))
    ) {
      return <>{children}</>;
    }
  }

  return <pre>{children}</pre>;
};

const CodeRenderer = memo(
  ({ className, children }: CodeRendererProps) => {
    const language = /language-(\w+)/.exec(className || '')?.[1];
    const codeText = String(children).replace(/\n$/, '');
    const isCodeBlock = codeText.includes('\n');

    if (language === 'mermaid') {
      return <MermaidWithToggle code={codeText} />;
    }

    if (language === 'chart') {
      return <ChartWithToggle code={codeText} />;
    }

    if (
      (language === 'svg' ||
        ((language === 'xml' || language === 'html') && isSvgCode(codeText))) &&
      isSvgCode(codeText)
    ) {
      return <SvgWithToggle code={codeText} />;
    }

    return (
      <>
        {language ? (
          <>
            <div className="flex">
              <span className="flex-auto">{language}</span>
              <ButtonCopy
                className="mr-2 justify-end text-gray-400"
                text={codeText}
              />
            </div>
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={language || 'plaintext'}>
              {codeText}
            </SyntaxHighlighter>
          </>
        ) : isCodeBlock ? (
          <code className="block rounded-md py-1">
            {codeText.split('\n').map((line, index) => (
              <span key={`line-${index}`} className="block px-1 py-0">
                {line}
              </span>
            ))}
          </code>
        ) : (
          <span className="bg-aws-squid-ink/10 border-aws-squid-ink/30 inline rounded-md border px-1 py-0.5">
            {codeText}
          </span>
        )}
      </>
    );
  },
  (prev, next) =>
    String(prev.children) === String(next.children) &&
    prev.className === next.className
);

// -- Main Markdown component --

type Props = BaseProps & {
  children: string;
  prefix?: string;
};

const Markdown = memo(({ className, prefix, children }: Props) => {
  return (
    <ReactMarkdown
      className={`${className ?? ''} prose max-w-full`}
      children={children}
      remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      remarkRehypeOptions={{ clobberPrefix: prefix }}
      components={{
        a: LinkRenderer,
        img: ImageRenderer,
        sup: ({ children }) => (
          <sup className="m-0.5 rounded-full bg-gray-200 px-1">{children}</sup>
        ),
        pre: PreRenderer,
        code: CodeRenderer,
      }}
    />
  );
});

export default Markdown;
