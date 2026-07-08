import { Button, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, cornerRadius, font, foregroundStyle, frame, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export const HOME_WIDGET_NAME = 'HomeChecklistWidget';
export const WIDGET_COMPLETE_NEXT_TARGET = 'complete-next-item';

export type HomeChecklistWidgetProps = {
  title: string;
  completed: number;
  total: number;
  percentage: number;
  nextItemTitle?: string;
};

const emptyProps: HomeChecklistWidgetProps = {
  title: '100 Khởi đầu mới',
  completed: 0,
  total: 0,
  percentage: 0,
};

function HomeChecklistWidget(props: HomeChecklistWidgetProps = emptyProps) {
  'widget';
  const title = props.title || emptyProps.title;
  const total = props.total || 0;
  const completed = props.completed || 0;
  const percentage = total === 0 ? 0 : props.percentage;
  const nextItem = props.nextItemTitle || 'Mở app để chọn thử thách';

  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[padding({ all: 14 }), cornerRadius(22)]}
    >
      <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#222222')]}>
        {title}
      </Text>
      <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#717171')]}>
        {completed}/{total} việc · {percentage}%
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle('#717171')]}>
        {nextItem}
      </Text>
      <HStack spacing={8}>
        <Button
          label="Đánh dấu"
          target={WIDGET_COMPLETE_NEXT_TARGET}
          modifiers={[buttonStyle('borderedProminent'), tint('#FF6B35')]}
        />
        <Text modifiers={[frame({ width: 1, height: 1 }), foregroundStyle('#FFFFFF')]}> </Text>
      </HStack>
    </VStack>
  );
}

export const HomeWidget = createWidget<HomeChecklistWidgetProps>(HOME_WIDGET_NAME, HomeChecklistWidget);
