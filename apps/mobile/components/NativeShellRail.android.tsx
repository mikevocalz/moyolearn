import {
  Host,
  RNHostView,
  WideNavigationRail,
  WideNavigationRailItem,
} from '@expo/ui/jetpack-compose';
import { Pressable, Text, View } from '@acme/ui/tw';
import type { NativeShellRailProps } from './NativeShellRail.types';

export function NativeShellRail({ items, expanded }: NativeShellRailProps) {
  const primaryAction = items.find((item) => item.raised);
  const destinations = items.filter((item) => !item.raised);

  return (
    <Host
      matchContents={{ horizontal: true }}
      style={{ height: '100%' }}
    >
      <WideNavigationRail expanded={expanded}>
        {primaryAction ? (
          <WideNavigationRail.Header>
            <RNHostView matchContents>
              <Pressable
                role="tab"
                aria-label={primaryAction.label}
                aria-selected={primaryAction.selected}
                onPress={primaryAction.onPress}
                className={`${expanded ? 'mx-inset flex-row gap-element px-inset' : 'self-center'} items-center py-stack active:opacity-80`}
              >
                <View className="h-nav-raised w-nav-raised items-center justify-center rounded-md border-2 border-on-surface-footer bg-nav-cta shadow-card">
                  <primaryAction.Icon size={30} className="text-on-nav-cta" />
                </View>
                {expanded ? (
                  <Text className="text-label font-bold text-on-surface-footer">
                    {primaryAction.label}
                  </Text>
                ) : null}
              </Pressable>
            </RNHostView>
          </WideNavigationRail.Header>
        ) : null}

        {destinations.map((item) => (
          <WideNavigationRailItem
            key={item.key}
            selected={item.selected}
            railExpanded={expanded}
            onClick={item.onPress}
          >
            <WideNavigationRailItem.Icon>
              <RNHostView matchContents>
                <View className="h-7 w-7 items-center justify-center">
                  <item.Icon
                    size={24}
                    className={item.selected ? 'text-on-nav-selected' : 'text-on-surface-footer'}
                  />
                </View>
              </RNHostView>
            </WideNavigationRailItem.Icon>
            <WideNavigationRailItem.Label>
              <RNHostView matchContents>
                <Text
                  numberOfLines={1}
                  className={`text-label ${item.selected ? 'font-bold' : 'font-semibold'} text-on-surface-footer`}
                >
                  {item.label}
                </Text>
              </RNHostView>
            </WideNavigationRailItem.Label>
          </WideNavigationRailItem>
        ))}
      </WideNavigationRail>
    </Host>
  );
}
