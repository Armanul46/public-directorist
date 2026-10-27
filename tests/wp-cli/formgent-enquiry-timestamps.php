<?php
/**
 * Check enquiry epochs against different database session timezones.
 * Requires an authenticated user with existing listing enquiries.
 *
 * Run: wp eval-file tests/wp-cli/formgent-enquiry-timestamps.php --user=<user-id>
 *
 * @package Directorist
 */

global $wpdb;

$integration = new ATBDP_Formgent();
$request     = new WP_REST_Request( 'GET', '/directorist/formgent/responses' );
$request->set_param( 'per_page', 2 );

$original_timezone = $wpdb->get_var( 'SELECT @@session.time_zone' );
$expected_epochs   = [];

try {
    foreach ( [ '+00:00', '+06:00', '-08:00' ] as $database_timezone ) {
        $wpdb->query( $wpdb->prepare( 'SET time_zone = %s', $database_timezone ) );

        foreach ( [ 'receive', 'send' ] as $box ) {
            $request->set_param( 'box', $box );
            $result = $integration->get_responses( $request );

            if ( empty( $result['responses'] ) ) {
                throw new RuntimeException( 'This test requires existing enquiries in both boxes.' );
            }

            foreach ( $result['responses'] as $response ) {
                $id    = (int) $response->id;
                $epoch = (int) $response->created_at_timestamp;

                if ( $epoch <= 0 || ( isset( $expected_epochs[ $id ] ) && $expected_epochs[ $id ] !== $epoch ) ) {
                    throw new RuntimeException( 'Enquiry epoch changed with the database timezone.' );
                }

                $expected_epochs[ $id ] = $epoch;
                $request->set_param( 'id', $id );
                $single = $integration->single_response( $request )->get_data();

                if ( (int) $single['response']->created_at_timestamp !== $epoch ) {
                    throw new RuntimeException( 'List and detail epochs do not match.' );
                }
            }
        }
    }
} finally {
    $wpdb->query( $wpdb->prepare( 'SET time_zone = %s', $original_timezone ) );
}

WP_CLI::success( 'Received/sent list and detail timestamps are stable across three database timezones.' );
