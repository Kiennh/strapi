import * as React from 'react';

import {
  SubNav,
  SubNavHeader,
  SubNavLink,
  SubNavSection,
  SubNavSections,
} from '@strapi/design-system/v2';
import { useCollator, useFilter, useFetchClient } from '@strapi/helper-plugin';
import { useIntl } from 'react-intl';
import { NavLink } from 'react-router-dom';

import { useTypedSelector } from '../../core/store/hooks';
import { useMenu } from '../../hooks/useMenu';
import { getTranslation } from '../utils/translations';

const LeftMenu = () => {
  const [search, setSearch] = React.useState('');
  const [data, setData] = React.useState({} as any);
  const { formatMessage, locale } = useIntl();
  const collectionTypeLinks = useTypedSelector(
    (state) => state['content-manager_app'].collectionTypeLinks
  );
  const singleTypeLinks = useTypedSelector((state) => state['content-manager_app'].singleTypeLinks);

  const { isLoading, pluginsSectionLinks } = useMenu();
  const { get } = useFetchClient();

  const { includes } = useFilter(locale, {
    sensitivity: 'base',
  });

  const formatter = useCollator(locale, {
    sensitivity: 'base',
  });

  const [defaultMenu, setDefaultMenu] = React.useState([
    {
      id: 'collectionTypes',
      title: formatMessage({
        id: getTranslation('components.LeftMenu.collection-types'),
        defaultMessage: 'Collection Types',
      }),
      searchable: true,
      links: collectionTypeLinks,
    },
    {
      id: 'singleTypes',
      title: formatMessage({
        id: getTranslation('components.LeftMenu.single-types'),
        defaultMessage: 'Single Types',
      }),
      searchable: true,
      links: singleTypeLinks,
    },
  ]);

  React.useEffect(() => {
    get('/path-amc/menu').then((resp) => {
      setData(resp.data);
    });
  }, [get]);
  const hasCustomMenu = React.useMemo(() => {
    return pluginsSectionLinks.find((f) => f?.to === '/plugins/path-amc');
  }, [pluginsSectionLinks]);

  const combinedMenu = React.useMemo(() => {
    return [...collectionTypeLinks, ...singleTypeLinks];
  }, [collectionTypeLinks, singleTypeLinks]);

  React.useEffect(() => {
    if (hasCustomMenu) {
      const userMenu = Object.keys(data?.menu || {}).find((role) =>
        data.user.roles.map((userRole: any) => userRole.name).includes(role)
      ) as any;
      if (typeof userMenu !== 'undefined') {
        setDefaultMenu(
          (data?.menu[userMenu] || []).map((section: any) => ({
            ...section,
            links: combinedMenu
              .filter((sub) => section?.links.includes(sub.name))
              /**
               * Filter by the search value
               */
              .filter((link) => includes(link.title, search))
              /**
               * Sort correctly using the language
               */
              .sort((a, b) => formatter.compare(a.title, b.title))
              /**
               * Apply the formated strings to the links from react-intl
               */
              .map((link) => {
                return {
                  ...link,
                  title: formatMessage({ id: link.title, defaultMessage: link.title }),
                };
              }),
          }))
        );
      }
    }
  }, [data, hasCustomMenu, combinedMenu, formatMessage, formatter]);

  const menu = React.useMemo(
    () =>
      defaultMenu.map((section) => ({
        ...section,
        links: section.links
          /**
           * Filter by the search value
           */
          .filter((link) => includes(link.title, search))
          /**
           * Sort correctly using the language
           */
          .sort((a, b) => formatter.compare(a.title, b.title))
          /**
           * Apply the formated strings to the links from react-intl
           */
          .map((link) => {
            return {
              ...link,
              title: formatMessage({ id: link.title, defaultMessage: link.title }),
            };
          }),
      })),
    [search, includes, formatMessage, formatter, defaultMenu]
  );

  const handleClear = () => {
    setSearch('');
  };

  const handleChangeSearch = ({ target: { value } }: { target: { value: string } }) => {
    setSearch(value);
  };

  const label = formatMessage({
    id: getTranslation('header.name'),
    defaultMessage: 'Content 1',
  });
  return (
    <SubNav ariaLabel={label}>
      <SubNavHeader
        label={label}
        searchable
        value={search}
        onChange={handleChangeSearch}
        onClear={handleClear}
        searchLabel={formatMessage({
          id: 'content-manager.components.LeftMenu.Search.label',
          defaultMessage: 'Search for a content type',
        })}
      />
      <SubNavSections>
        {menu.map((section) => {
          return (
            <SubNavSection
              collapsable={true}
              key={section.id}
              label={section.title}
              badgeLabel={section.links.length.toString()}
            >
              {section.links.map((link) => {
                const search = link.search ? `?${link.search}` : '';

                return (
                  // @ts-expect-error – DS inference does not work with the `as` prop.
                  <SubNavLink as={NavLink} key={link.uid} to={`${link.to}${search}`}>
                    {link.title}
                  </SubNavLink>
                );
              })}
            </SubNavSection>
          );
        })}
      </SubNavSections>
    </SubNav>
  );
};

export { LeftMenu };
