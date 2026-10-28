import type { ComponentPropsWithoutRef } from 'react';

type AppLogoIconProps = Omit<ComponentPropsWithoutRef<'img'>, 'src'> & {
  img?: string;
};

export default function AppLogoIcon({
  img = '/images/logobv.png',
  alt = 'Logo',
  ...props
}: AppLogoIconProps) {
  return <img src={img} alt={alt} {...props} />;
}
